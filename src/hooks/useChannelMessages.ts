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
  body_text: string | null;
  body_html: string | null;
  raw_payload: any;
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
};

const PAGE_SIZE = 50;

export function useChannelMessages(channel?: string) {
  const queryClient = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: ["channel-messages", channel],
    queryFn: async ({ pageParam = 0 }) => {
      let q = supabase
        .from("channel_messages")
        .select("*")
        .order("email_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1);

      if (channel && channel !== "all") {
        q = q.eq("channel", channel);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as ChannelMessage[];
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
export { useCheckInbox, useContinuousSync } from "./useEmailSync";
export { useMarkAsRead, useUnreadCount, useMessageAttachments, type EmailAttachment } from "./useEmailActions";
