/**
 * Core channel messages query hook with classic pagination and realtime.
 */

import { useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { findChannelMessagesPage, type ChannelMessageRow } from "@/data/channelMessages";
import { useEffect } from "react";
import { createLogger } from "@/lib/log";
import { queryKeys } from "@/lib/queryKeys";

const log = createLogger("useChannelMessages");

export type ChannelMessage = ChannelMessageRow;

const PAGE_SIZE = 50;

export type MailboxFilter = { kind: "personal" } | { kind: "shared"; id: string } | null | undefined;

function mailboxKeyOf(mb: MailboxFilter): string | undefined {
  if (!mb) return undefined;
  return mb.kind === "shared" ? `shared:${mb.id}` : "personal";
}

export function useChannelMessages(
  channel?: string,
  searchQuery?: string,
  page = 0,
  operatorUserId?: string,
  mailboxFilter?: MailboxFilter,
) {
  const queryClient = useQueryClient();
  const mailboxKey = mailboxKeyOf(mailboxFilter);

  const query = useQuery({
    queryKey: queryKeys.channelMessages.list(channel, searchQuery, page, operatorUserId, mailboxKey),
    queryFn: async () => {
      return findChannelMessagesPage({
        channel,
        searchQuery,
        page,
        pageSize: PAGE_SIZE,
        operatorUserId,
        mailboxFilter,
      });
    },
    staleTime: 30_000,
  });

  // Realtime: prepend new row to page 0 cache instead of full invalidation
  useEffect(() => {
    const filterStr = channel && channel !== "all" ? `channel=eq.${channel}` : undefined;
    const sub = supabase
      .channel(`channel_messages_rt_${channel || "all"}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "channel_messages",
          ...(filterStr ? { filter: filterStr } : {}),
        },
        (payload) => {
          const newRow = payload.new as ChannelMessage;
          // Vol. II §10.1: dedup per id E per message_id_external (UID race-safe)
          const baseKey = queryKeys.channelMessages.list(channel, searchQuery, 0, undefined);
          queryClient.setQueryData<ChannelMessage[]>([...baseKey], (old) => {
            if (!old) return old;
            // dedup by id
            if (old.some((m) => m.id === newRow.id)) return old;
            // dedup by external id (sync race possibile)
            if (newRow.message_id_external) {
              const existingIdx = old.findIndex((m) => m.message_id_external === newRow.message_id_external);
              if (existingIdx >= 0) {
                const next = old.slice();
                next[existingIdx] = newRow;
                return next;
              }
            }
            log.debug("realtime.prepend", { channel, id: newRow.id });
            return [newRow, ...old].slice(0, PAGE_SIZE);
          });
          queryClient.invalidateQueries({ queryKey: queryKeys.email.count });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [queryClient, channel, searchQuery]);

  return {
    ...query,
    data: query.data ?? [],
    isLoading: query.isLoading,
    pageSize: PAGE_SIZE,
  };
}

// Re-export from split modules for backward compatibility
export { useCheckInbox, useResetSync } from "./useEmailSync";
export { useContinuousSync } from "./useContinuousSync";
export { useMarkAsRead, useUnreadCount, useMessageAttachments, type EmailAttachment } from "./useEmailActions";
