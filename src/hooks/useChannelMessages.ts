/**
 * Core channel messages query hook with infinite scroll and realtime.
 */

import { useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

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
  raw_payload?: any;
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

export function useChannelMessages(channel?: string, searchQuery?: string) {
  const queryClient = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: ["channel-messages", channel, searchQuery],
    queryFn: async ({ pageParam = 0 }) => {
      let q = supabase
        .from("channel_messages")
        .select(MESSAGE_LIST_SELECT)
        .order("email_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1);

      if (channel && channel !== "all") {
        q = q.eq("channel", channel);
      }

      // Full-text search using GIN index
      if (searchQuery && searchQuery.trim()) {
        const terms = searchQuery.trim().split(/\s+/).map(t => `${t}:*`).join(" & ");
        q = q.textSearch("search_vector", terms);
      }

      const { data, error } = await q;
      if (error) throw error;
      return ((data || []) as unknown) as ChannelMessage[];
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      return lastPage.length === PAGE_SIZE ? lastPageParam + 1 : undefined;
    },
  });

  // Realtime subscription
  useEffect(() => {
    const sub = supabase
      .channel("channel_messages_realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "channel_messages" }, () => {
        queryClient.invalidateQueries({ queryKey: ["channel-messages"] });
      })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [queryClient]);

  const messages = query.data?.pages.flat() ?? [];

  return {
    ...query,
    data: messages,
    isLoading: query.isLoading,
  };
}

// Re-export from split modules for backward compatibility
export { useCheckInbox, useResetSync } from "./useEmailSync";
export { useContinuousSync } from "./useContinuousSync";
export { useMarkAsRead, useUnreadCount, useMessageAttachments, type EmailAttachment } from "./useEmailActions";
