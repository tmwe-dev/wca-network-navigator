/**
 * WhatsApp Progressive Read (ex-Backfill)
 * Uses the same reliable `readUnread` method as the test panel.
 * Loops readUnread with pauses, deduplicates via deterministic IDs.
 * Stops when 2 consecutive cycles return 0 new messages.
 */
import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWhatsAppExtensionBridge } from "./useWhatsAppExtensionBridge";
import { buildDeterministicId } from "@/lib/messageDedup";
import { toast } from "sonner";

type BackfillStatus = "idle" | "running" | "paused" | "done" | "error";

type BackfillProgress = {
  status: BackfillStatus;
  cycle: number;
  totalCycles: number;
  recoveredMessages: number;
  lastError: string | null;
};

const INITIAL_PROGRESS: BackfillProgress = {
  status: "idle",
  cycle: 0,
  totalCycles: 10,
  recoveredMessages: 0,
  lastError: null,
};

const MAX_CYCLES = 10;
const PAUSE_BETWEEN_CYCLES_MS = 7000; // 7s between reads

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

      let totalRecovered = 0;
      let emptyStreak = 0;

      for (let cycle = 1; cycle <= MAX_CYCLES; cycle++) {
        if (abortRef.current) {
          setProgress(p => ({ ...p, status: "paused" }));
          toast.info("Lettura progressiva interrotta");
          return;
        }

        setProgress(p => ({ ...p, cycle, totalCycles: MAX_CYCLES }));

        // Call readUnread — same as test panel
        const result = await bridge.readUnread();

        if (!result.success) {
          setProgress(p => ({ ...p, status: "error", lastError: result.error || "Errore lettura sidebar" }));
          toast.error("Errore lettura WhatsApp");
          return;
        }

        const messages = (result.messages || []) as Array<any>;
        const validMessages = messages.filter(
          (m: any) =>
            typeof m?.contact === "string" &&
            m.contact.trim() &&
            m.contact !== "Sconosciuto" &&
            m.isVerify !== true &&
            m.text?.trim()
        );

        // Save each message with upsert (ignoreDuplicates via deterministic ID)
        let newInCycle = 0;
        for (const msg of validMessages) {
          const contact = msg.contact.trim();
          const externalId = buildDeterministicId("wa", contact, msg.text || "", msg.timestamp);

          const { error } = await supabase.from("channel_messages").upsert(
            {
              user_id: user.id,
              channel: "whatsapp",
              direction: msg.direction || "inbound",
              from_address: msg.direction === "outbound" ? undefined : contact,
              to_address: msg.direction === "outbound" ? contact : undefined,
              body_text: msg.text,
              message_id_external: externalId,
            },
            { onConflict: "message_id_external", ignoreDuplicates: true }
          );

          if (!error) newInCycle++;
        }

        totalRecovered += newInCycle;
        setProgress(p => ({ ...p, recoveredMessages: totalRecovered, lastError: null }));

        // Exit condition: 2 consecutive cycles with 0 new
        if (newInCycle === 0) {
          emptyStreak++;
          if (emptyStreak >= 2) break;
        } else {
          emptyStreak = 0;
        }

        // Pause between cycles (skip after last)
        if (cycle < MAX_CYCLES) {
          setProgress(p => ({ ...p, status: "paused" }));
          const aborted = await sleepAbortable(PAUSE_BETWEEN_CYCLES_MS, abortRef);
          if (aborted) {
            setProgress(p => ({ ...p, status: "paused" }));
            toast.info("Lettura progressiva interrotta");
            return;
          }
          setProgress(p => ({ ...p, status: "running" }));
        }
      }

      setProgress(p => ({ ...p, status: "done", cycle: p.cycle }));
      toast.success(`Lettura completata: ${totalRecovered} nuovi messaggi`);
    } catch (err: any) {
      setProgress(p => ({ ...p, status: "error", lastError: err.message }));
      toast.error(`Errore: ${err.message}`);
    }
  }, [progress.status, bridge]);

  const stopBackfill = useCallback(() => {
    abortRef.current = true;
  }, []);

  return { progress, startBackfill, stopBackfill };
}
