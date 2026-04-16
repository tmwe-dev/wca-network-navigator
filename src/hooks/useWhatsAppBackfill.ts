/**
 * WhatsApp Deep Backfill — Cursor-based, resumable.
 * Each click processes one page backward per chat, persisting progress.
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
  chatsCompleted: number;
  recoveredMessages: number;
  duplicatesSkipped: number;
  lastError: string | null;
};

const INITIAL_PROGRESS: BackfillProgress = {
  status: "idle",
  phase: "idle",
  currentChat: null,
  chatsProcessed: 0,
  chatsTotal: 0,
  chatsCompleted: 0,
  recoveredMessages: 0,
  duplicatesSkipped: 0,
  lastError: null,
};

const MAX_CHATS_PER_SESSION = 10;
const PAUSE_BETWEEN_CHATS_MS = 17500;
const MAX_SCROLLS_PER_CHAT = 30;
const MAX_MESSAGES_PER_THREAD = 50;

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

      const { data: opRow } = await supabase
        .from("operators")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      const operatorId = opRow?.id ?? null;
      if (!operatorId) {
        toast.error("Nessun operatore associato");
        return;
      }

      // ── PHASE 1: Discovery ──
      const sidebarResult = await bridge.readUnread();
      if (!sidebarResult.success || !sidebarResult.messages?.length) {
        setProgress(p => ({ ...p, status: "done", phase: "idle" }));
        toast.info("Nessun contatto da recuperare");
        return;
      }

      if (abortRef.current) { setProgress(p => ({ ...p, status: "paused", phase: "idle" })); return; }

      // Get unique contacts from sidebar
      const sidebarContacts = new Map<string, { name: string; lastMessage: string; time: string }>();
      for (const msg of sidebarResult.messages as Record<string, unknown>[]) {
        const contact = String(msg.contact || msg.from || "").trim();
        if (!contact || contact === "Sconosciuto" || msg.isVerify) continue;
        if (!sidebarContacts.has(contact.toLowerCase())) {
          sidebarContacts.set(contact.toLowerCase(), {
            name: contact,
            lastMessage: String(msg.lastMessage || msg.text || ""),
            time: String(msg.time || msg.timestamp || ""),
          });
        }
      }

      // Filter: skip chats where cursor says reached_beginning
      const chatList = Array.from(sidebarContacts.values()).slice(0, MAX_CHATS_PER_SESSION);
      const chatsToProcess: Array<{
        name: string;
        lastMessage: string;
        cursorOldestId: string | null;
        cursorOldestAt: string | null;
        cursorMsgCount: number;
      }> = [];

      for (const chat of chatList) {
        const chatId = chat.name.toLowerCase();
        const { data: cursor } = await supabase
          .from("channel_backfill_state")
          .select("oldest_message_external_id, oldest_message_at, reached_beginning, messages_imported")
          .eq("channel", "whatsapp")
          .eq("external_chat_id", chatId)
          .maybeSingle();

        if (cursor?.reached_beginning) continue;

        chatsToProcess.push({
          name: chat.name,
          lastMessage: chat.lastMessage,
          cursorOldestId: cursor?.oldest_message_external_id ?? null,
          cursorOldestAt: cursor?.oldest_message_at ?? null,
          cursorMsgCount: cursor?.messages_imported ?? 0,
        });
      }

      if (chatsToProcess.length === 0) {
        setProgress(p => ({ ...p, status: "done", phase: "idle" }));
        toast.success("Tutte le chat sono complete ✅");
        return;
      }

      // ── PHASE 2: Deep Recovery with cursor ──
      setProgress(p => ({ ...p, phase: "deep", chatsTotal: chatsToProcess.length, chatsProcessed: 0 }));

      let totalRecovered = 0;
      let totalDupes = 0;
      let totalCompleted = 0;

      for (let i = 0; i < chatsToProcess.length; i++) {
        if (abortRef.current) {
          setProgress(p => ({ ...p, status: "paused", phase: "idle" }));
          toast.info("Recupero interrotto");
          return;
        }

        const chat = chatsToProcess[i];
        const chatId = chat.name.toLowerCase();
        setProgress(p => ({ ...p, currentChat: chat.name, chatsProcessed: i }));

        let messages: Array<Record<string, unknown>> = [];
        let attemptError: string | null = null;

        try {
          // Try readThread first
          const threadResult = await bridge.readThread(chat.name, MAX_MESSAGES_PER_THREAD);
          if (threadResult.success && threadResult.messages?.length) {
            messages = threadResult.messages as Record<string, unknown>[];
          }

          // If we have a cursor anchor and it's not found, scroll deeper
          if (chat.cursorOldestId && messages.length > 0) {
            const anchorText = chat.lastMessage?.trim().toLowerCase();
            const foundAnchor = anchorText && messages.some((m) => {
              const t = String(m.text || m.lastMessage || "").trim().toLowerCase();
              return t === anchorText;
            });

            if (!foundAnchor) {
              const backfillResult = await bridge.backfillChat(
                chat.name,
                chat.lastMessage || null,
                MAX_SCROLLS_PER_CHAT
              );
              if (backfillResult.success && backfillResult.messages?.length) {
                messages = [...messages, ...(backfillResult.messages as Record<string, unknown>[])];
              }
            }
          } else if (!chat.cursorOldestId) {
            // No cursor yet — do initial deep scroll
            const backfillResult = await bridge.backfillChat(chat.name, null, MAX_SCROLLS_PER_CHAT);
            if (backfillResult.success && backfillResult.messages?.length) {
              messages = [...messages, ...(backfillResult.messages as Record<string, unknown>[])];
            }
          }
        } catch (err: unknown) {
          attemptError = err instanceof Error ? err.message : String(err);
        }

        // Save messages via upsert
        let chatRecovered = 0;
        let chatDupes = 0;
        let oldestAt: string | null = null;
        let oldestExtId: string | null = null;
        let newestAt: string | null = null;
        let newestExtId: string | null = null;

        for (const msg of messages) {
          const contact = String(msg.contact || msg.from || chat.name).trim();
          const rawText = String(msg.text || msg.lastMessage || "");
          if (!rawText.trim()) continue;

          const { direction, cleanText } = detectDirection(rawText);
          const finalDirection = String(msg.direction || direction);
          const text = cleanText.trim();
          if (!text) continue;

          const rawTime = String(msg.time || msg.timestamp || "");
          const extId = buildDeterministicId("wa", contact, text, rawTime || new Date().toISOString());
          const timestamp = rawTime || new Date().toISOString();

          // Track oldest/newest
          if (!oldestAt || timestamp < oldestAt) { oldestAt = timestamp; oldestExtId = extId; }
          if (!newestAt || timestamp > newestAt) { newestAt = timestamp; newestExtId = extId; }

          const { error, status } = await supabase
            .from("channel_messages")
            .upsert({
              user_id: user.id,
              operator_id: operatorId,
              channel: "whatsapp",
              direction: finalDirection,
              from_address: finalDirection === "outbound" ? undefined : contact,
              to_address: finalDirection === "outbound" ? contact : undefined,
              body_text: text,
              message_id_external: extId,
              raw_payload: msg as never,
            } as never, { onConflict: "user_id,message_id_external", ignoreDuplicates: true });

          if (!error && status === 201) chatRecovered++;
          else chatDupes++;
        }

        // Update cursor
        const reachedBeginning = messages.length === 0 && !attemptError;
        if (reachedBeginning) totalCompleted++;

        await supabase.from("channel_backfill_state").upsert({
          operator_id: operatorId,
          channel: "whatsapp",
          external_chat_id: chatId,
          chat_display_name: chat.name,
          ...(oldestExtId ? { oldest_message_external_id: oldestExtId, oldest_message_at: oldestAt } : {}),
          ...(newestExtId ? { newest_message_external_id: newestExtId, newest_message_at: newestAt } : {}),
          messages_imported: chat.cursorMsgCount + chatRecovered,
          reached_beginning: reachedBeginning,
          last_attempt_at: new Date().toISOString(),
          last_attempt_status: attemptError ? "error" : (messages.length > 0 ? "ok" : "partial"),
          last_error: attemptError,
        } as never, { onConflict: "operator_id,channel,external_chat_id" });

        totalRecovered += chatRecovered;
        totalDupes += chatDupes;
        setProgress(p => ({
          ...p,
          chatsProcessed: i + 1,
          chatsCompleted: totalCompleted,
          recoveredMessages: totalRecovered,
          duplicatesSkipped: totalDupes,
        }));

        // Pause between chats
        if (i < chatsToProcess.length - 1) {
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
      toast.success(`Recupero completato: ${totalRecovered} messaggi da ${chatsToProcess.length} chat (${totalDupes} duplicati skippati)`);
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
