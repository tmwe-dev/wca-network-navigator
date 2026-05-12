/**
 * useUnreadCountsV2 — Sidebar badge counts
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveMailbox } from "@/contexts/ActiveMailboxContext";

interface UnreadCounts {
  readonly unreadMessages: number;
  readonly pendingTasks: number;
  readonly pendingQueue: number;
}

export function useUnreadCountsV2() {
  const { activeMailbox } = useActiveMailbox();
  const mailboxKey = activeMailbox
    ? `${activeMailbox.kind}:${activeMailbox.mailbox_id}`
    : "none";

  return useQuery({
    queryKey: ["v2", "unread-counts", mailboxKey],
    queryFn: async (): Promise<UnreadCounts> => {
      // Filtro mailbox-aware: il badge deve riflettere la casella attiva.
      // - personale → mailbox_id IS NULL
      // - condivisa → mailbox_id == id specifico
      let msgQuery = supabase
        .from("channel_messages")
        .select("id", { count: "exact", head: true })
        .is("read_at", null)
        .eq("direction", "inbound");
      if (activeMailbox?.kind === "personal") {
        msgQuery = msgQuery.is("mailbox_id", null);
      } else if (activeMailbox?.kind === "shared") {
        msgQuery = msgQuery.eq("mailbox_id", activeMailbox.mailbox_id);
      }
      const [msgRes, taskRes, queueRes] = await Promise.all([
        msgQuery,
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
