import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

import { fetchUnreadCounts, type UnreadCountsResult } from "@/data/unreadCounts";

export type UnreadCounts = UnreadCountsResult;

export function useUnreadCounts() {
  const queryClient = useQueryClient();

  // Realtime: invalidate counter on inbound INSERT / read_at UPDATE on
  // channel_messages and on activities status changes. Polling stays as a
  // safety net but at a much lower frequency.
  useEffect(() => {
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.channelMessages.unreadCounts });
    };
    const channel = supabase
      .channel("unread-counts-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "channel_messages" }, invalidate)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "channel_messages" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "activities" }, invalidate)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: queryKeys.channelMessages.unreadCounts,
    queryFn: fetchUnreadCounts,
    refetchInterval: 120_000,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
