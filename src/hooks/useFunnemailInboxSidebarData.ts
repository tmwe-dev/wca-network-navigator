import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/AuthProvider";
import { queryKeys } from "@/lib/queryKeys";
import { listFunnemailGroupedInbox, type FunnemailGroupedInbox } from "@/data/funnemailInbox";

export function useFunnemailInboxSidebarData() {
  const { user } = useAuth();
  return useQuery<FunnemailGroupedInbox>({
    queryKey: queryKeys.funnemailInbox.grouped(user?.id ?? "anon"),
    queryFn: () => listFunnemailGroupedInbox(user!.id),
    enabled: !!user?.id,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}