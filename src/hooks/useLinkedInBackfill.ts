/**
 * LinkedIn Backfill - Ultra Conservative
 * Max 1 thread per session, 6x delays vs WhatsApp.
 */
import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLinkedInMessagingBridge } from "./useLinkedInMessagingBridge";
import { buildDeterministicId } from "@/lib/messageDedup";
import { toast } from "sonner";
import { insertChannelMessage } from "@/data/channelMessages";

type BackfillStatus = "idle" | "running" | "paused" | "done" | "error";

type BackfillProgress = {
  status: BackfillStatus;
  currentThread: string | null;
  recoveredMessages: number;
  errors: number;
  pauseReason: string | null;
  pauseEndsAt: number | null;
  lastError: string | null;
};

const INITIAL: BackfillProgress = {
  status: "idle", currentThread: null, recoveredMessages: 0, errors: 0,
  pauseReason: null, pauseEndsAt: null, lastError: null,
};

// Ultra-conservative: 1 thread, long delays
const _MAX_THREADS_PER_SESSION = 1;
const DELAY_BETWEEN_ACTIONS_MS = 18_000; // 18s between actions (6x WA's ~3s)

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

export function useLinkedInBackfill() {
  const [progress, setProgress] = useState<BackfillProgress>(INITIAL);
  const abortRef = useRef(false);
  const { isAvailable: _isAvailable, readInbox, readThread } = useLinkedInMessagingBridge();

  const startBackfill = useCallback(async () => {
    if (progress.status === "running") return;
    abortRef.current = false;
    setProgress({ ...INITIAL, status: "running" });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Non autenticato"); return; }

      // Read inbox threads
      setProgress(p => ({ ...p, currentThread: "Lettura inbox..." }));
      const inboxResult = await readInbox();
      if (!inboxResult.success || !inboxResult.threads?.length) {
        toast.info("Nessun thread LinkedIn trovato");
        setProgress(p => ({ ...p, status: "done" }));
        return;
      }

      // Only process first thread (ultra-conservative)
      const thread = inboxResult.threads[0];
      setProgress(p => ({ ...p, currentThread: thread.name }));

      // Wait before reading thread details
      const aborted = await sleepAbortable(DELAY_BETWEEN_ACTIONS_MS, abortRef);
      if (aborted) {
        setProgress(p => ({ ...p, status: "paused", pauseReason: "Interrotto manualmente" }));
        return;
      }

      // Read thread messages
      if (thread.threadUrl) {
        const threadResult = await readThread(thread.threadUrl);
        if (threadResult.success && threadResult.messages?.length) {
          let saved = 0;
          for (const msg of threadResult.messages) {
            const extId = buildDeterministicId("li", thread.name || "", msg.text || "", msg.timestamp);
            const error = await insertChannelMessage({
              user_id: user.id,
              channel: "linkedin",
              direction: msg.direction === "outbound" ? "outbound" : "inbound",
              from_address: msg.direction === "outbound" ? undefined : thread.name,
              to_address: msg.direction === "outbound" ? thread.name : undefined,
              body_text: msg.text,
              message_id_external: extId,
            }).then(() => null).catch(e => e);
            if (!error) saved++;
          }
          setProgress(p => ({ ...p, recoveredMessages: saved }));
        } else {
          setProgress(p => ({ ...p, lastError: threadResult.error || "Nessun messaggio trovato" }));
        }
      }

      setProgress(p => ({ ...p, status: "done", currentThread: null }));
      toast.success(`Backfill LinkedIn completato`);
    } catch (err: unknown) {
      setProgress(p => ({ ...p, status: "error", lastError: err instanceof Error ? err.message : String(err) }));
      toast.error(`Errore: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [progress.status, readInbox, readThread]);

  const stopBackfill = useCallback(() => {
    abortRef.current = true;
  }, []);

  return { progress, startBackfill, stopBackfill };
}
