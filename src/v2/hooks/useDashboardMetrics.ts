/**
 * useDashboardMetrics — Live counts for dashboard cards
 */
import { useQuery } from "@tanstack/react-query";
import { fetchDashboardCounts, type DashboardCounts } from "@/v2/io/supabase/queries/dashboard";
import { isOk } from "@/v2/core/domain/result";
import { queryKeys } from "@/lib/queryKeys";

const EMPTY_COUNTS: DashboardCounts = {
  partners: 0,
  contacts: 0,
  pendingActivities: 0,
  activeAgents: 0,
  campaignJobs: 0,
  emailDrafts: 0,
};

export function useDashboardMetrics() {
  return useQuery({
    queryKey: queryKeys.v2.dashboardMetrics(),
    queryFn: async (): Promise<DashboardCounts> => {
      const result = await fetchDashboardCounts();
      if (isOk(result)) return result.value;
      return EMPTY_COUNTS;
    },
    refetchInterval: 30_000, // refresh every 30s
  });
}
