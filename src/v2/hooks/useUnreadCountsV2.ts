/**
 * useUnreadCountsV2 — Sidebar badge counts
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface UnreadCounts {
  readonly unreadMessages: number;
  readonly pendingTasks: number;
  readonly pendingQueue: number;
}

export function useUnreadCountsV2() {
  return useQuery({
    queryKey: ["v2", "unread-counts"],
    queryFn: async (): Promise<UnreadCounts> => {
      const [msgRes, taskRes, queueRes] = await Promise.all([
        supabase.from("channel_messages").select("id", { count: "exact", head: true }).is("read_at", null).eq("direction", "inbound"),
        supabase.from("activities").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("email_campaign_queue").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      return {
        unreadMessages: msgRes.count ?? 0,
        pendingTasks: taskRes.count ?? 0,
        pendingQueue: queueRes.count ?? 0,
      };
    },
    refetchInterval: 30000,
  });
}
