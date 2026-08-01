/**
 * useEmailCampaignQueueV2 — Campaign queue monitor
 */
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { findCampaignQueueStatuses } from "@/data/emailCampaigns";

interface CampaignQueueStats {
  readonly pending: number;
  readonly completed: number;
  readonly failed: number;
  readonly total: number;
}

export function useEmailCampaignQueueV2(draftId?: string) {
  return useQuery({
    queryKey: queryKeys.v2.emailCampaignQueue(draftId ?? "global"),
    queryFn: async (): Promise<CampaignQueueStats> => {
      let data;
      try {
        data = await findCampaignQueueStatuses(draftId);
      } catch {
        return { pending: 0, completed: 0, failed: 0, total: 0 };
      }
      const pending = data.filter((r) => r.status === "pending").length;
      const completed = data.filter((r) => r.status === "completed").length;
      const failed = data.filter((r) => r.status === "failed").length;
      return { pending, completed, failed, total: data.length };
    },
    refetchInterval: 5000,
  });
}
