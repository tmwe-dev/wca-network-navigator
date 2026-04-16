/**
 * LinkedIn Backfill — Cursor-based, resumable.
 * Ultra conservative: 1 thread per session, 6x delays vs WhatsApp.
 */
import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLinkedInMessagingBridge } from "./useLinkedInMessagingBridge";
import { buildDeterministicId } from "@/lib/messageDedup";
import { toast } from "sonner";

type BackfillStatus = "idle" | "running" | "paused" | "done" | "error";

type BackfillProgress = {
  status: BackfillStatus;
  currentThread: string | null;
  recoveredMessages: number;
  duplicatesSkipped: number;
  errors: number;
  pauseReason: string | null;
  pauseEndsAt: number | null;
  lastError: string | null;
};

const INITIAL: BackfillProgress = {
  status: "idle", currentThread: null, recoveredMessages: 0, duplicatesSkipped: 0,
  errors: 0, pauseReason: null, pauseEndsAt: null, lastError: null,
};

const DELAY_BETWEEN_ACTIONS_MS = 18_000;

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
  const runningRef = useRef(false);
  const { isAvailable: _isAvailable, readInbox, readThread } = useLinkedInMessagingBridge();

  const startBackfill = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    abortRef.current = false;
    setProgress({ ...INITIAL, status: "running" });

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

      // Read inbox threads
      setProgress(p => ({ ...p, currentThread: "Lettura inbox..." }));
      const inboxResult = await readInbox();
      if (!inboxResult.success || !inboxResult.threads?.length) {
        toast.info("Nessun thread LinkedIn trovato");
        setProgress(p => ({ ...p, status: "done" }));
        return;
      }

      // Find first thread not yet completed
      let threadToProcess: (typeof inboxResult.threads)[0] | null = null;
      for (const thread of inboxResult.threads) {
        if (!thread.threadUrl) continue;
        const chatId = thread.threadUrl.toLowerCase();
        const { data: cursor } = await supabase
          .from("channel_backfill_state")
          .select("reached_beginning")
          .eq("channel", "linkedin")
          .eq("external_chat_id", chatId)
          .maybeSingle();
        if (!cursor?.reached_beginning) {
          threadToProcess = thread;
          break;
        }
      }

      if (!threadToProcess) {
        toast.success("Tutti i thread LinkedIn sono completi ✅");
        setProgress(p => ({ ...p, status: "done" }));
        return;
      }

      setProgress(p => ({ ...p, currentThread: threadToProcess!.name }));

      // Wait before reading thread details
      const aborted = await sleepAbortable(DELAY_BETWEEN_ACTIONS_MS, abortRef);
      if (aborted) {
        setProgress(p => ({ ...p, status: "paused", pauseReason: "Interrotto manualmente" }));
        return;
      }

      const chatId = threadToProcess.threadUrl!.toLowerCase();

      // Load cursor
      const { data: cursor } = await supabase
        .from("channel_backfill_state")
        .select("oldest_message_external_id, oldest_message_at, messages_imported")
        .eq("channel", "linkedin")
        .eq("external_chat_id", chatId)
        .maybeSingle();

      // Read thread messages
      const threadResult = await readThread(threadToProcess.threadUrl!);
      let saved = 0;
      let dupes = 0;
      let oldestAt: string | null = null;
      let oldestExtId: string | null = null;
      let newestAt: string | null = null;
      let newestExtId: string | null = null;

      if (threadResult.success && threadResult.messages?.length) {
        for (const msg of threadResult.messages) {
          const extId = buildDeterministicId("li", threadToProcess.name || "", msg.text || "", msg.timestamp);
          const timestamp = msg.timestamp || new Date().toISOString();

          if (!oldestAt || timestamp < oldestAt) { oldestAt = timestamp; oldestExtId = extId; }
          if (!newestAt || timestamp > newestAt) { newestAt = timestamp; newestExtId = extId; }

          const { error, status } = await supabase
            .from("channel_messages")
            .upsert({
              user_id: user.id,
              operator_id: operatorId,
              channel: "linkedin",
              direction: msg.direction === "outbound" ? "outbound" : "inbound",
              from_address: msg.direction === "outbound" ? undefined : threadToProcess.name,
              to_address: msg.direction === "outbound" ? threadToProcess.name : undefined,
              body_text: msg.text,
              message_id_external: extId,
              thread_id: threadToProcess.threadUrl || null,
            } as never, { onConflict: "user_id,message_id_external", ignoreDuplicates: true });

          if (!error && status === 201) saved++;
          else dupes++;
        }
      }

      const reachedBeginning = !threadResult.messages?.length;

      // Update cursor
      await supabase.from("channel_backfill_state").upsert({
        operator_id: operatorId,
        channel: "linkedin",
        external_chat_id: chatId,
        chat_display_name: threadToProcess.name,
        ...(oldestExtId ? { oldest_message_external_id: oldestExtId, oldest_message_at: oldestAt } : {}),
        ...(newestExtId ? { newest_message_external_id: newestExtId, newest_message_at: newestAt } : {}),
        messages_imported: (cursor?.messages_imported ?? 0) + saved,
        reached_beginning: reachedBeginning,
        last_attempt_at: new Date().toISOString(),
        last_attempt_status: "ok",
        last_error: null,
      } as never, { onConflict: "operator_id,channel,external_chat_id" });

      setProgress(p => ({ ...p, status: "done", currentThread: null, recoveredMessages: saved, duplicatesSkipped: dupes }));
      toast.success(`Backfill LinkedIn: ${saved} messaggi salvati${dupes > 0 ? `, ${dupes} duplicati` : ""}`);
    } catch (err: unknown) {
      setProgress(p => ({ ...p, status: "error", lastError: err instanceof Error ? err.message : String(err) }));
      toast.error(`Errore: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      runningRef.current = false;
    }
  }, [readInbox, readThread]);

  const stopBackfill = useCallback(() => {
    abortRef.current = true;
  }, []);

  return { progress, startBackfill, stopBackfill };
}
