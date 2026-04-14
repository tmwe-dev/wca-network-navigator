/**
 * Core channel messages query hook with classic pagination and realtime.
 */

import { useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { createLogger } from "@/lib/log";

const log = createLogger("useChannelMessages");

export type ChannelMessage = {
  id: string;
  user_id: string;
  channel: string;
  direction: string;
  source_type: string | null;
  source_id: string | null;
  partner_id: string | null;
  from_address: string | null;
  to_address: string | null;
  cc_addresses: string | null;
  bcc_addresses: string | null;
  subject: string | null;
  body_text?: string | null;
  body_html?: string | null;
  raw_payload?: unknown;
  message_id_external: string | null;
  in_reply_to: string | null;
  read_at: string | null;
  created_at: string;
  email_date: string | null;
  raw_storage_path: string | null;
  raw_sha256: string | null;
  raw_size_bytes: number | null;
  imap_uid: number | null;
  uidvalidity: number | null;
  imap_flags: string | null;
  internal_date: string | null;
  parse_status: string | null;
  parse_warnings: string[] | null;
  thread_id: string | null;
  references_header: string | null;
};

const PAGE_SIZE = 50;

const MESSAGE_LIST_SELECT = [
  "id",
  "user_id",
  "channel",
  "direction",
  "source_type",
  "source_id",
  "partner_id",
  "from_address",
  "to_address",
  "cc_addresses",
  "bcc_addresses",
  "subject",
  "body_text",
  "raw_payload",
  "message_id_external",
  "in_reply_to",
  "read_at",
  "created_at",
  "email_date",
  "raw_storage_path",
  "raw_sha256",
  "raw_size_bytes",
  "imap_uid",
  "uidvalidity",
  "imap_flags",
  "internal_date",
  "parse_status",
  "parse_warnings",
  "thread_id",
  "references_header",
].join(", ");

export function useChannelMessages(channel?: string, searchQuery?: string, page = 0, operatorUserId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["channel-messages", channel, searchQuery, page, operatorUserId],
    queryFn: async () => {
      let q = supabase
        .from("channel_messages")
        .select(MESSAGE_LIST_SELECT)
        .order("email_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (channel && channel !== "all") {
        q = q.eq("channel", channel);
      }

      // Admin filtering by specific operator
      if (operatorUserId) {
        q = q.eq("user_id", operatorUserId);
      }

      if (searchQuery && searchQuery.trim()) {
        const terms = searchQuery.trim().split(/\s+/).map(t => `${t}:*`).join(" & ");
        q = q.textSearch("search_vector", terms);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as ChannelMessage[];
    },
    staleTime: 30_000,
  });

  // Realtime: prepend new row to page 0 cache instead of full invalidation
  useEffect(() => {
    const filterStr = channel && channel !== "all" ? `channel=eq.${channel}` : undefined;
    const sub = supabase
      .channel(`channel_messages_rt_${channel || "all"}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "channel_messages",
        ...(filterStr ? { filter: filterStr } : {}),
      }, (payload) => {
        const newRow = payload.new as ChannelMessage;
        // Vol. II §10.1: dedup per id E per message_id_external (UID race-safe)
        const baseKey = ["channel-messages", channel, searchQuery, 0];
        queryClient.setQueryData<ChannelMessage[]>(baseKey, (old) => {
          if (!old) return old;
          // dedup by id
          if (old.some(m => m.id === newRow.id)) return old;
          // dedup by external id (sync race possibile)
          if (newRow.message_id_external) {
            const existingIdx = old.findIndex(
              m => m.message_id_external === newRow.message_id_external
            );
            if (existingIdx >= 0) {
              const next = old.slice();
              next[existingIdx] = newRow;
              return next;
            }
          }
          log.debug("realtime.prepend", { channel, id: newRow.id });
          return [newRow, ...old].slice(0, PAGE_SIZE);
        });
        queryClient.invalidateQueries({ queryKey: ["email-count"] });
      })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
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
