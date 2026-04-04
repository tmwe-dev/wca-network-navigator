/**
 * WhatsApp Backfill Orchestrator
 * Recovers missed messages when extension was offline.
 * Anti-detection: random delays, session limits, circuit breaker.
 */
import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWhatsAppExtensionBridge } from "./useWhatsAppExtensionBridge";
import { buildDeterministicId } from "@/lib/messageDedup";
import { toast } from "sonner";

type BackfillStatus = "idle" | "running" | "paused" | "done" | "error";

type BackfillProgress = {
  status: BackfillStatus;
  currentChat: string | null;
  nextChat: string | null;
  processedChats: number;
  totalChats: number;
  recoveredMessages: number;
  errors: number;
  pauseReason: string | null;
  pauseEndsAt: number | null; // timestamp ms
  lastError: string | null;
};

const INITIAL_PROGRESS: BackfillProgress = {
  status: "idle", currentChat: null, nextChat: null,
  processedChats: 0, totalChats: 0, recoveredMessages: 0, errors: 0,
  pauseReason: null, pauseEndsAt: null, lastError: null,
};

// Human-like delay pattern (seconds)
const CHAT_DELAYS = [3, 8, 2, 5, 12, 4, 7, 3, 15, 5, 4, 9, 3, 6, 11, 4];
const LONG_PAUSE_EVERY = 10;
const LONG_PAUSE_MIN = 60;
const LONG_PAUSE_MAX = 120;
const MAX_CHATS_PER_SESSION = 25;
const MAX_SESSION_MINUTES = 45;
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_PAUSE_MS = 10 * 60 * 1000; // 10 min

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function sleepWithCountdown(
  ms: number,
  setProgress: React.Dispatch<React.SetStateAction<BackfillProgress>>,
  abortRef: React.MutableRefObject<boolean>
): Promise<void> {
  return new Promise((resolve) => {
    const endsAt = Date.now() + ms;
    setProgress(p => ({ ...p, pauseEndsAt: endsAt }));

    const interval = setInterval(() => {
      if (abortRef.current || Date.now() >= endsAt) {
        clearInterval(interval);
        setProgress(p => ({ ...p, pauseEndsAt: null }));
        resolve();
      }
    }, 500);
  });
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

export function useWhatsAppBackfill() {
  const [progress, setProgress] = useState<BackfillProgress>(INITIAL_PROGRESS);
  const abortRef = useRef(false);
  const bridge = useWhatsAppExtensionBridge();

  const startBackfill = useCallback(async () => {
    if (progress.status === "running") return;
    abortRef.current = false;

    setProgress({ ...INITIAL_PROGRESS, status: "running" });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Non autenticato"); return; }

      // Get last known messages per contact
      const { data: lastMessages } = await supabase
        .from("channel_messages")
        .select("from_address, to_address, body_text, created_at, direction")
        .eq("channel", "whatsapp")
        .order("created_at", { ascending: false })
        .limit(1000);

      const contactLastMsg = new Map<string, string>();
      for (const msg of (lastMessages || [])) {
        const contact = msg.direction === "inbound" ? msg.from_address : msg.to_address;
        if (contact && !contactLastMsg.has(contact)) {
          contactLastMsg.set(contact, msg.body_text || "");
        }
      }

      // Read sidebar
      const sidebarResult = await bridge.readUnread();
      if (!sidebarResult.success) {
        toast.error("Impossibile leggere la sidebar WhatsApp");
        setProgress(p => ({ ...p, status: "error", lastError: "Sidebar non leggibile" }));
        return;
      }

      const chats = sidebarResult.messages || [];
      const totalChats = Math.min(chats.length, MAX_CHATS_PER_SESSION);
      setProgress(p => ({ ...p, totalChats }));

      const sessionStart = Date.now();
      let consecutiveErrors = 0;
      let totalRecovered = 0;

      for (let i = 0; i < totalChats; i++) {
        if (abortRef.current) {
          setProgress(p => ({ ...p, status: "paused", pauseReason: "Interrotto manualmente" }));
          toast.info("Backfill interrotto");
          return;
        }

        // Session time limit
        if (Date.now() - sessionStart > MAX_SESSION_MINUTES * 60 * 1000) {
          toast.info("Sessione massima raggiunta (45 min)");
          break;
        }

        // Circuit breaker
        if (consecutiveErrors >= CIRCUIT_BREAKER_THRESHOLD) {
          const pauseMs = CIRCUIT_BREAKER_PAUSE_MS;
          setProgress(p => ({
            ...p,
            status: "paused",
            pauseReason: `${consecutiveErrors} errori consecutivi — pausa di sicurezza`,
          }));
          toast.warning(`Pausa di sicurezza: riprendo tra ${Math.round(pauseMs / 60000)} min`);
          await sleepWithCountdown(pauseMs, setProgress, abortRef);
          if (abortRef.current) return;
          consecutiveErrors = 0;
          setProgress(p => ({ ...p, status: "running", pauseReason: null }));
        }

        const chat = chats[i];
        const contact = chat.contact;
        const nextContact = i + 1 < totalChats ? chats[i + 1].contact : null;
        setProgress(p => ({
          ...p,
          currentChat: contact,
          nextChat: nextContact,
          processedChats: i,
        }));

        try {
          const lastKnown = contactLastMsg.get(contact) || "";
          const result = await bridge.backfillChat(contact, lastKnown, 30);

          if (result.success && result.messages?.length) {
            let saved = 0;
            for (const msg of result.messages) {
              const { error } = await supabase.from("channel_messages").insert({
                user_id: user.id,
                channel: "whatsapp",
                direction: msg.direction || "inbound",
                from_address: msg.direction === "outbound" ? undefined : contact,
                to_address: msg.direction === "outbound" ? contact : undefined,
                body_text: msg.text,
                message_id_external: buildDeterministicId("wa", contact, msg.text || "", msg.timestamp),
              });
              if (!error) saved++;
            }
            totalRecovered += saved;
            consecutiveErrors = 0;
            setProgress(p => ({ ...p, recoveredMessages: totalRecovered, lastError: null }));
          } else if (!result.success) {
            consecutiveErrors++;
            const errMsg = result.error || "Errore lettura chat";
            setProgress(p => ({ ...p, errors: p.errors + 1, lastError: `${contact}: ${errMsg}` }));
          } else {
            consecutiveErrors = 0;
          }
        } catch (err: any) {
          consecutiveErrors++;
          setProgress(p => ({
            ...p, errors: p.errors + 1,
            lastError: `${contact}: ${err?.message || "Errore sconosciuto"}`,
          }));
        }

        // Human-like delay between chats (abortable)
        const delayIdx = i % CHAT_DELAYS.length;
        const delaySec = CHAT_DELAYS[delayIdx] + randomBetween(-1, 2);
        const aborted = await sleepAbortable(delaySec * 1000, abortRef);
        if (aborted) {
          setProgress(p => ({ ...p, status: "paused", pauseReason: "Interrotto manualmente" }));
          toast.info("Backfill interrotto");
          return;
        }

        // Long pause every N chats
        if ((i + 1) % LONG_PAUSE_EVERY === 0 && i < totalChats - 1) {
          const pauseSec = randomBetween(LONG_PAUSE_MIN, LONG_PAUSE_MAX);
          setProgress(p => ({
            ...p,
            status: "paused",
            pauseReason: `Pausa anti-detection (ogni ${LONG_PAUSE_EVERY} chat)`,
          }));
          await sleepWithCountdown(pauseSec * 1000, setProgress, abortRef);
          if (abortRef.current) return;
          setProgress(p => ({ ...p, status: "running", pauseReason: null }));
        }
      }

      setProgress(p => ({
        ...p, status: "done", currentChat: null, nextChat: null,
        processedChats: totalChats, pauseReason: null, pauseEndsAt: null,
      }));
      toast.success(`Backfill completato: ${totalRecovered} messaggi recuperati da ${totalChats} chat`);
    } catch (err: any) {
      setProgress(p => ({ ...p, status: "error", lastError: err.message }));
      toast.error(`Errore backfill: ${err.message}`);
    }
  }, [progress.status, bridge]);

  const stopBackfill = useCallback(() => {
    abortRef.current = true;
  }, []);

  return { progress, startBackfill, stopBackfill };
}
