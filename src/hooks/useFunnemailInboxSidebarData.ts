import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/AuthProvider";
import { useActiveOperator } from "@/contexts/ActiveOperatorContext";
import { useActiveMailbox } from "@/contexts/ActiveMailboxContext";
import { queryKeys } from "@/lib/queryKeys";
import { listFunnemailGroupedInbox, type FunnemailGroupedInbox } from "@/data/funnemailInbox";

export function useFunnemailInboxSidebarData() {
  const { user } = useAuth();
  const { activeOperator, operators, viewingAll } = useActiveOperator();
  const { activeMailbox } = useActiveMailbox();
  // Vedi useFunnemailInbox: usiamo activeOperator solo se è davvero
  // accessibile dall'utente corrente, altrimenti fallback su user.id.
  const trustedActiveOp =
    activeOperator && operators.some((o) => o.id === activeOperator.id)
      ? activeOperator
      : null;
  const targetUserId = viewingAll ? null : trustedActiveOp?.user_id ?? user?.id ?? null;
  const folderOwnerUserId = targetUserId ?? user?.id ?? null;
  const mailboxFilter = activeMailbox
    ? activeMailbox.kind === "shared"
      ? { kind: "shared" as const, id: activeMailbox.mailbox_id }
      : { kind: "personal" as const }
    : null;
  const mailboxKey = activeMailbox ? `${activeMailbox.kind}:${activeMailbox.mailbox_id}` : "none";
  return useQuery<FunnemailGroupedInbox>({
    queryKey: queryKeys.funnemailInbox.grouped(folderOwnerUserId ?? "anon", targetUserId, mailboxKey),
    queryFn: () => listFunnemailGroupedInbox(folderOwnerUserId!, targetUserId, mailboxFilter),
    enabled: !!folderOwnerUserId,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}