/**
 * useRAScrapingV2 — RA scraping engine state
 */
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { findRAScrapingJobs } from "@/data/raScrapingJobsV2";

interface RAScrapingJob {
  readonly id: string;
  readonly status: string;
  readonly countryCode: string;
  readonly countryName: string;
  readonly networkName: string;
  readonly totalCount: number;
  readonly currentIndex: number;
  readonly createdAt: string;
}

export function useRAScrapingV2() {
  return useQuery({
    queryKey: queryKeys.v2.raScrapingJobs(),
    queryFn: async (): Promise<readonly RAScrapingJob[]> => {
      const data = await findRAScrapingJobs(20);
      return data.map((r) => ({
        id: r.id,
        status: r.status,
        countryCode: r.country_code,
        countryName: r.country_name,
        networkName: r.network_name,
        totalCount: r.total_count,
        currentIndex: r.current_index,
        createdAt: r.created_at,
      }));
    },
  });
}
