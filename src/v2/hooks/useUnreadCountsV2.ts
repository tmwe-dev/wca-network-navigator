/**
 * useUnreadCountsV2 — Sidebar badge counts
 */
import { useQuery } from "@tanstack/react-query";
import { useActiveMailbox } from "@/contexts/ActiveMailboxContext";
import { fetchUnreadCounts } from "@/data/unreadCounts";

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
      return fetchUnreadCounts(
        activeMailbox
          ? { kind: activeMailbox.kind, mailbox_id: activeMailbox.mailbox_id }
          : null,
      );
    },
    refetchInterval: 30000,
  });
}
