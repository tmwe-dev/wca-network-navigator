/**
 * LinkedIn Adaptive Sync
 * Ultra-conservative: sync every 30 minutes, 6x delays.
 * Backfill limited to 1 thread per session.
 */
import { useEffect, useRef, useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLinkedInMessagingBridge } from "./useLinkedInMessagingBridge";
import { toast } from "sonner";

const SYNC_INTERVAL = 30 * 60 * 1000; // 30 minutes
const JITTER_FACTOR = 0.2; // ±20%

function jitter(base: number) {
  return base * (0.8 + Math.random() * 0.4);
}

function buildExternalId(contact: string, timestamp: string, text: string): string {
  const safeText = (text || "").slice(0, 50).replace(/[|]/g, "_");
  const safeContact = (contact || "unknown").replace(/[|]/g, "_");
  return `li_${safeContact}_${timestamp}_${safeText}`;
}

export function useLinkedInSync() {
  const [enabled, setEnabled] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);

  const { isAvailable, readInbox } = useLinkedInMessagingBridge();
  const queryClient = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enabledRef = useRef(false);

  const doSync = useCallback(async () => {
    if (!enabledRef.current || !isAvailable) return;
    setIsReading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const result = await readInbox();
      if (!result.success || !result.threads?.length) return;

      let newMsgs = 0;
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
        });
        if (!error) newMsgs++;
      }

      if (newMsgs > 0) {
        queryClient.invalidateQueries({ queryKey: ["channel-messages", "linkedin"] });
      }
      setLastSyncAt(Date.now());
    } catch (err: any) {
      console.warn("[LI Sync]", err.message);
    } finally {
      setIsReading(false);
      scheduleNext();
    }
  }, [isAvailable, readInbox, queryClient]);

  const scheduleNext = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!enabledRef.current) return;
    timerRef.current = setTimeout(doSync, jitter(SYNC_INTERVAL));
  }, [doSync]);

  const toggle = useCallback(() => {
    setEnabled(prev => {
      const next = !prev;
      enabledRef.current = next;
      if (next) {
        doSync();
      } else {
        if (timerRef.current) clearTimeout(timerRef.current);
      }
      return next;
    });
  }, [doSync]);

  const readNow = useCallback(() => {
    doSync();
  }, [doSync]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { enabled, toggle, isReading, isAvailable, readNow, lastSyncAt };
}
