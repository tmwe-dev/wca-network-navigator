/**
 * useDownloadJobsV2 — Download jobs management
 */
import { useQuery } from "@tanstack/react-query";
import { fetchDownloadJobs, fetchDownloadJobsByCountry } from "@/v2/io/supabase/queries/download-jobs";
import { isOk } from "@/v2/core/domain/result";
import type { DownloadJob } from "@/v2/core/domain/entities";

export function useDownloadJobsV2(countryCode?: string) {
  return useQuery({
    queryKey: ["v2", "download-jobs", countryCode ?? "all"],
    queryFn: async (): Promise<readonly DownloadJob[]> => {
      const result = countryCode
        ? await fetchDownloadJobsByCountry(countryCode)
        : await fetchDownloadJobs();
      return isOk(result) ? result.value : [];
    },
  });
}
