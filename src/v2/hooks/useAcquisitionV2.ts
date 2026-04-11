/**
 * useAcquisitionV2 — Acquisition pipeline for WCA partner download
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AcquisitionStats {
  readonly totalCountries: number;
  readonly countriesScanned: number;
  readonly totalPartnersFound: number;
  readonly activeJobs: number;
}

export function useAcquisitionV2() {
  const statsQuery = useQuery({
    queryKey: ["v2", "acquisition-stats"],
    queryFn: async (): Promise<AcquisitionStats> => {
      const [cacheRes, jobsRes] = await Promise.all([
        supabase.from("directory_cache").select("country_code, total_results"),
        supabase.from("download_jobs").select("status").in("status", ["running", "paused"]),
      ]);
      const cache = cacheRes.data ?? [];
      const jobs = jobsRes.data ?? [];
      return {
        totalCountries: new Set(cache.map((c) => c.country_code)).size,
        countriesScanned: cache.length,
        totalPartnersFound: cache.reduce((s, c) => s + (c.total_results ?? 0), 0),
        activeJobs: jobs.length,
      };
    },
  });

  return statsQuery;
}
