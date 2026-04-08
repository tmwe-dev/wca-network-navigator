/**
 * LinkedIn Adaptive Sync
 * Ultra-conservative: sync every 30 minutes, 6x delays.
 * Backfill limited to 1 thread per session.
 */
import { useEffect, useRef, useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLinkedInMessagingBridge } from "./useLinkedInMessagingBridge";
import { buildDeterministicId } from "@/lib/messageDedup";
import { createLogger } from "@/lib/log";

const log = createLogger("useLinkedInSync");
import { toast } from "sonner";

const SYNC_INTERVAL = 30 * 60 * 1000; // 30 minutes

function jitter(base: number) {
  return base * (0.8 + Math.random() * 0.4);
}

function buildExternalId(contact: string, timestamp: string, text: string): string {
  return buildDeterministicId("li", contact, text, timestamp);
}

export function useLinkedInSync() {
  const [enabled, setEnabled] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);

  const { isAvailable, readInbox } = useLinkedInMessagingBridge();
  const queryClient = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enabledRef = useRef(false);

  // Core sync logic — separated from guard so readNow can bypass enabled check
  const performSync = useCallback(async () => {
    if (!isAvailable) {
      toast.error("Estensione LinkedIn non disponibile");
      return;
    }
    setIsReading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Non autenticato");
        return;
      }

      const result = await readInbox();
      log.debug("readInbox result", { preview: JSON.stringify(result).slice(0, 500) });

      if (!result.success) {
        toast.error(`Lettura LinkedIn fallita: ${result.error || "errore sconosciuto"}`);
        return;
      }

      if (!result.threads?.length) {
        toast.info("Nessun thread LinkedIn trovato nell'inbox");
        return;
      }

      let newMsgs = 0;
      let dupes = 0;
      for (const thread of result.threads) {
        if (!thread.lastMessage || !thread.name) continue;
        const extId = buildExternalId(thread.name, new Date().toISOString(), thread.lastMessage);
        const { error } = await supabase.from("channel_messages").insert({
          user_id: user.id,
          channel: "linkedin",
          direction: "inbound",
          from_address: thread.name,
          body_text: thread.lastMessage,
          message_id_external: extId,
          thread_id: thread.threadUrl || null,
        });
        if (!error) newMsgs++;
        else if (error.code === "23505") dupes++;
        else log.warn("insert error", { message: error.message });
      }

      if (newMsgs > 0) {
        queryClient.invalidateQueries({ queryKey: ["channel-messages", "linkedin"] });
        toast.success(`${newMsgs} nuovi messaggi LinkedIn salvati`);
      } else if (dupes > 0) {
        toast.info("Messaggi LinkedIn già sincronizzati");
      } else {
        toast.info(`${result.threads.length} thread letti, nessun nuovo messaggio`);
      }
      setLastSyncAt(Date.now());
    } catch (err: any) {
      log.warn("sync error", { message: err instanceof Error ? err.message : String(err) });
      toast.error(`Errore sync: ${err.message}`);
    } finally {
      setIsReading(false);
    }
  }, [isAvailable, readInbox, queryClient]);

  // Auto-sync (only when enabled)
  const doAutoSync = useCallback(async () => {
    if (!enabledRef.current) return;
    await performSync();
    scheduleNext();
  }, [performSync]);

  const scheduleNext = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!enabledRef.current) return;
    timerRef.current = setTimeout(doAutoSync, jitter(SYNC_INTERVAL));
  }, [doAutoSync]);

  const toggle = useCallback(() => {
    setEnabled(prev => {
      const next = !prev;
      enabledRef.current = next;
      if (next) {
        doAutoSync();
        toast.success("Sync LinkedIn attivato (ogni 30 min)");
      } else {
        if (timerRef.current) clearTimeout(timerRef.current);
        toast.info("Sync LinkedIn disattivato");
      }
      return next;
    });
  }, [doAutoSync]);

  // readNow works regardless of enabled state
  const readNow = useCallback(() => {
    performSync();
  }, [performSync]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { enabled, toggle, isReading, isAvailable, readNow, lastSyncAt };
}
