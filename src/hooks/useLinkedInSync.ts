/**
 * LinkedIn Manual Sync — download only on user click.
 * No polling, no timers, no auto-sync.
 */
import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLinkedInMessagingBridge } from "./useLinkedInMessagingBridge";
import { buildDeterministicId } from "@/lib/messageDedup";
import { createLogger } from "@/lib/log";

const log = createLogger("useLinkedInSync");
import { toast } from "sonner";
import { insertChannelMessage } from "@/data/channelMessages";
import { queryKeys } from "@/lib/queryKeys";

function buildExternalId(contact: string, timestamp: string, text: string): string {
  return buildDeterministicId("li", contact, text, timestamp);
}

export function useLinkedInSync() {
  const [isReading, setIsReading] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);

  const { isAvailable, readInbox } = useLinkedInMessagingBridge();
  const queryClient = useQueryClient();

  const readNow = useCallback(async () => {
    if (!isAvailable) {
      toast.error("Estensione LinkedIn non disponibile");
      return;
    }
    setIsReading(true);
    try {
      const { data: { session: __s } } = await supabase.auth.getSession(); const user = __s?.user ?? null;
      if (!user) {
        toast.error("Non autenticato");
        return;
      }

      // Resolve operator_id
      const { data: opRow } = await supabase
        .from("operators")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      const operatorId = opRow?.id ?? null;
      if (!operatorId) {
        log.warn("No operator found for user, skipping sync");
        toast.error("Nessun operatore associato");
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
        const result2 = await insertChannelMessage({
          user_id: user.id,
          operator_id: operatorId,
          channel: "linkedin",
          direction: "inbound",
          from_address: thread.name,
          body_text: thread.lastMessage,
          message_id_external: extId,
          thread_id: thread.threadUrl || null,
        });
        if (result2.inserted) newMsgs++;
        else dupes++;
      }

      if (newMsgs > 0) {
        queryClient.invalidateQueries({ queryKey: queryKeys.channelMessages.all });
        toast.success(`${newMsgs} nuovi messaggi LinkedIn salvati`);
      }
      window.dispatchEvent(new CustomEvent("channel-sync-done", { detail: { channel: "linkedin" } }));
      setLastSyncAt(Date.now());
    } catch (err: unknown) {
      log.warn("sync error", { message: err instanceof Error ? err.message : String(err) });
      toast.error(`Errore sync: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsReading(false);
    }
  }, [isAvailable, readInbox, queryClient]);

  return { isReading, isAvailable, readNow, lastSyncAt };
}
