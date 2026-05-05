import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/AuthProvider";
import { useActiveOperator } from "@/contexts/ActiveOperatorContext";
import { queryKeys } from "@/lib/queryKeys";
import { listFunnemailGroupedInbox, type FunnemailGroupedInbox } from "@/data/funnemailInbox";

export function useFunnemailInboxSidebarData() {
  const { user } = useAuth();
  const { activeOperator, viewingAll } = useActiveOperator();
  const targetUserId = viewingAll ? null : activeOperator?.user_id ?? user?.id ?? null;
  return useQuery<FunnemailGroupedInbox>({
    queryKey: queryKeys.funnemailInbox.grouped(user?.id ?? "anon", targetUserId),
    queryFn: () => listFunnemailGroupedInbox(user!.id, targetUserId),
    enabled: !!user?.id,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}