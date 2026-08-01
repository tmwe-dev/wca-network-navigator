/**
 * useDashboardOperativeMetrics — Instant structured metrics (no AI)
 */
import { useQuery } from "@tanstack/react-query";
import { fetchOperativeMetrics, type OperativeMetrics } from "@/v2/io/supabase/queries/dashboard";
import { queryKeys } from "@/lib/queryKeys";

export type { OperativeMetrics };

export function useDashboardOperativeMetrics() {
  return useQuery({
    queryKey: queryKeys.v2.dashboard,
    queryFn: async (): Promise<OperativeMetrics> => {
      const result = await fetchOperativeMetrics();
      if (result._tag === "Err") throw new Error(result.error.message);
      return result.value;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
