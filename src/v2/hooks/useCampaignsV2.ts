/**
 * useCampaignsV2 — STEP 8
 * Hook for campaign jobs.
 */

import { useQuery } from "@tanstack/react-query";
import { fetchCampaignJobs } from "@/v2/io/supabase/queries/campaigns";
import { isOk } from "@/v2/core/domain/result";
import type { CampaignJob } from "@/v2/core/domain/entities";
import { queryKeys } from "@/lib/queryKeys";

export function useCampaignJobsV2(batchId: string | null) {
  return useQuery({
    queryKey: queryKeys.v2.campaignDrafts(batchId),
    queryFn: async (): Promise<readonly CampaignJob[]> => {
      if (!batchId) return [];
      const jobResult = await fetchCampaignJobs(batchId);
      if (isOk(jobResult)) return jobResult.value;
      return [];
    },
    enabled: !!batchId,
  });
}
