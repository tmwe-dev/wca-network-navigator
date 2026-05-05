import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/AuthProvider";
import { useActiveOperator } from "@/contexts/ActiveOperatorContext";
import { queryKeys } from "@/lib/queryKeys";
import { listFunnemailGroupedInbox, type FunnemailGroupedInbox } from "@/data/funnemailInbox";

export function useFunnemailInboxSidebarData() {
  const { user } = useAuth();
  const { activeOperator, viewingAll } = useActiveOperator();
  const targetUserId = viewingAll ? null : activeOperator?.user_id ?? user?.id ?? null;
  const folderOwnerUserId = targetUserId ?? user?.id ?? null;
  return useQuery<FunnemailGroupedInbox>({
    queryKey: queryKeys.funnemailInbox.grouped(folderOwnerUserId ?? "anon", targetUserId),
    queryFn: () => listFunnemailGroupedInbox(folderOwnerUserId!, targetUserId),
    enabled: !!folderOwnerUserId,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}