/**
 * useDownloadJobsV2 — Download jobs management
 */
import { useQuery } from "@tanstack/react-query";
import { fetchDownloadJobs, fetchDownloadJobsByCountry } from "@/v2/io/supabase/queries/download-jobs";
import { isOk } from "@/v2/core/domain/result";
import type { DownloadJob } from "@/v2/core/domain/entities";
import { queryKeys } from "@/lib/queryKeys";

export function useDownloadJobsV2(countryCode?: string) {
  return useQuery({
    queryKey: queryKeys.v2.downloadJobs(countryCode ?? "all"),
    queryFn: async (): Promise<readonly DownloadJob[]> => {
      const result = countryCode
        ? await fetchDownloadJobsByCountry(countryCode)
        : await fetchDownloadJobs();
      return isOk(result) ? result.value : [];
    },
  });
}
