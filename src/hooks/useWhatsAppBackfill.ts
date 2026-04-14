/**
 * WhatsApp Deep Backfill — Two-Phase Recovery
 * Phase 1: Sidebar discovery → find contacts with potential gaps
 * Phase 2: Deep recovery → readThread/backfillChat per contact with 15-20s delays
 * Triggered automatically on WhatsApp reconnection or manually.
 */
import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWhatsAppExtensionBridge } from "./useWhatsAppExtensionBridge";
import { buildDeterministicId } from "@/lib/messageDedup";
import { toast } from "sonner";

type BackfillStatus = "idle" | "running" | "paused" | "done" | "error";
type BackfillPhase = "idle" | "discovery" | "deep";

type BackfillProgress = {
  status: BackfillStatus;
  phase: BackfillPhase;
  currentChat: string | null;
  chatsProcessed: number;
  chatsTotal: number;
  recoveredMessages: number;
  lastError: string | null;
};

const INITIAL_PROGRESS: BackfillProgress = {
  status: "idle",
  phase: "idle",
  currentChat: null,
  chatsProcessed: 0,
  chatsTotal: 0,
  recoveredMessages: 0,
  lastError: null,
};

const MAX_CHATS_PER_SESSION = 10;
const PAUSE_BETWEEN_CHATS_MS = 17500; // 15-20s with jitter ±15%
const MAX_SCROLLS_PER_CHAT = 30;
const MAX_MESSAGES_PER_THREAD = 50;

// Jitter ±15% on the pause
function jitteredPause(base: number): number {
  return base * (0.85 + Math.random() * 0.30);
}

function sleepAbortable(ms: number, abortRef: React.MutableRefObject<boolean>): Promise<boolean> {
  return new Promise((resolve) => {
    const start = Date.now();
    const interval = setInterval(() => {
      if (abortRef.current || Date.now() - start >= ms) {
        clearInterval(interval);
        resolve(abortRef.current);
      }
    }, 250);
  });
}

// Outbound detection (same as adaptive sync)
const OUTBOUND_PREFIXES = ["tu: ", "you: ", "tú: ", "du: ", "vous: ", "вы: ", "あなた: "];
function detectDirection(text: string): { direction: "inbound" | "outbound"; cleanText: string } {
  const lower = text.toLowerCase();
  for (const prefix of OUTBOUND_PREFIXES) {
    if (lower.startsWith(prefix)) {
      return { direction: "outbound", cleanText: text.slice(prefix.length) };
    }
  }
  return { direction: "inbound", cleanText: text };
}

export function useWhatsAppBackfill() {
  const [progress, setProgress] = useState<BackfillProgress>(INITIAL_PROGRESS);
  const abortRef = useRef(false);
  const runningRef = useRef(false);
  const bridge = useWhatsAppExtensionBridge();

  const startBackfill = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    abortRef.current = false;

    setProgress({ ...INITIAL_PROGRESS, status: "running", phase: "discovery" });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Non autenticato"); return; }

      // ── PHASE 1: Discovery ──
      const sidebarResult = await bridge.readUnread();
      if (!sidebarResult.success || !sidebarResult.messages?.length) {
        setProgress(p => ({ ...p, status: "done", phase: "idle" }));
        toast.info("Nessun contatto da recuperare");
        return;
      }

      if (abortRef.current) { setProgress(p => ({ ...p, status: "paused", phase: "idle" })); return; }

      // Get unique contacts from sidebar
      const sidebarContacts = new Map<string, any>();
      for (const msg of sidebarResult.messages as unknown[]) {
        const contact = String(msg.contact || msg.from || "").trim();
        if (!contact || contact === "Sconosciuto" || msg.isVerify) continue;
        if (!sidebarContacts.has(contact.toLowerCase())) {
          sidebarContacts.set(contact.toLowerCase(), { name: contact, lastMessage: msg.lastMessage || msg.text || "", time: msg.time || msg.timestamp || "" });
        }
      }

      // For each contact, check if we have a gap (compare last DB message)
      const contactsWithGap: { name: string; lastDbText: string | null }[] = [];

      for (const [, info] of sidebarContacts) {
        if (contactsWithGap.length >= MAX_CHATS_PER_SESSION) break;

        const { data: lastMsg } = await supabase
          .from("channel_messages")
          .select("body_text, created_at")
          .eq("user_id", user.id)
          .eq("channel", "whatsapp")
          .or(`from_address.ilike.%${info.name}%,to_address.ilike.%${info.name}%`)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        // If sidebar shows a different last message than what we have, there's a gap
        const sidebarText = info.lastMessage.trim().toLowerCase();
        const dbText = (lastMsg?.body_text || "").trim().toLowerCase();

        if (!lastMsg || (sidebarText && sidebarText !== dbText)) {
          contactsWithGap.push({ name: info.name, lastDbText: lastMsg?.body_text || null });
        }
      }

      if (contactsWithGap.length === 0) {
        setProgress(p => ({ ...p, status: "done", phase: "idle" }));
        toast.success("Tutte le chat sono aggiornate ✅");
        return;
      }

      // ── PHASE 2: Deep Recovery ──
      setProgress(p => ({
        ...p,
        phase: "deep",
        chatsTotal: contactsWithGap.length,
        chatsProcessed: 0,
      }));

      let totalRecovered = 0;

      for (let i = 0; i < contactsWithGap.length; i++) {
        if (abortRef.current) {
          setProgress(p => ({ ...p, status: "paused", phase: "idle" }));
          toast.info("Recupero interrotto");
          return;
        }

        const chat = contactsWithGap[i];
        setProgress(p => ({ ...p, currentChat: chat.name, chatsProcessed: i }));

        let messages: Array<Record<string, unknown>> = [];

        // Try readThread first (reads visible messages in chat)
        const threadResult = await bridge.readThread(chat.name, MAX_MESSAGES_PER_THREAD);
        if (threadResult.success && threadResult.messages?.length) {
          messages = threadResult.messages as unknown[];
        }

        // If we have a last known message and got messages, check if we need deeper scroll
        if (chat.lastDbText && messages.length > 0) {
          const foundAnchor = messages.some((m) => {
            const t = String(m.text || m.lastMessage || "").trim().toLowerCase();
            return t === chat.lastDbText!.trim().toLowerCase();
          });

          // If anchor not found in visible messages, do deep backfill scroll
          if (!foundAnchor) {
            const backfillResult = await bridge.backfillChat(chat.name, chat.lastDbText, MAX_SCROLLS_PER_CHAT);
            if (backfillResult.success && backfillResult.messages?.length) {
              // Merge, dedup will handle overlaps
              messages = [...messages, ...(backfillResult.messages as unknown[])];
            }
          }
        }

        // Save all messages
        let chatRecovered = 0;
        for (const msg of messages) {
          const contact = String(msg.contact || msg.from || chat.name).trim();
          const rawText = String(msg.text || msg.lastMessage || "");
          if (!rawText.trim()) continue;

          const { direction, cleanText } = detectDirection(rawText);
          const finalDirection = msg.direction || direction;
          const text = cleanText.trim();
          if (!text) continue;

          const rawTime = String(msg.time || msg.timestamp || "");
          const extId = buildDeterministicId("wa", contact, text, rawTime || new Date().toISOString());

          const { error, status } = await supabase
            .from("channel_messages")
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic upsert
            .upsert({
              user_id: user.id,
              channel: "whatsapp",
              direction: finalDirection,
              from_address: finalDirection === "outbound" ? undefined : contact,
              to_address: finalDirection === "outbound" ? contact : undefined,
              body_text: text,
              message_id_external: extId,
              raw_payload: msg as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- boundary cast
            } as any, { onConflict: "user_id,message_id_external", ignoreDuplicates: true }); // eslint-disable-line @typescript-eslint/no-explicit-any -- boundary cast

          if (!error && status === 201) chatRecovered++;
        }

        totalRecovered += chatRecovered;
        setProgress(p => ({
          ...p,
          chatsProcessed: i + 1,
          recoveredMessages: totalRecovered,
        }));

        // Pause between chats (skip after last)
        if (i < contactsWithGap.length - 1) {
          const pause = jitteredPause(PAUSE_BETWEEN_CHATS_MS);
          setProgress(p => ({ ...p, status: "paused" }));
          const aborted = await sleepAbortable(pause, abortRef);
          if (aborted) {
            setProgress(p => ({ ...p, status: "paused", phase: "idle" }));
            toast.info("Recupero interrotto");
            return;
          }
          setProgress(p => ({ ...p, status: "running" }));
        }
      }

      setProgress(p => ({ ...p, status: "done", phase: "idle", currentChat: null }));
      toast.success(`Recupero completato: ${totalRecovered} messaggi da ${contactsWithGap.length} chat`);
    } catch (err: unknown) {
      setProgress(p => ({ ...p, status: "error", phase: "idle", lastError: (err instanceof Error ? err.message : String(err)) }));
      toast.error(`Errore recupero: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      runningRef.current = false;
    }
  }, [bridge]);

  const stopBackfill = useCallback(() => {
    abortRef.current = true;
  }, []);

  return { progress, startBackfill, stopBackfill };
}
