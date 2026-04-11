/**
 * useRAScrapingV2 — RA scraping engine state
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
    queryKey: ["v2", "ra-scraping"],
    queryFn: async (): Promise<readonly RAScrapingJob[]> => {
      const { data, error } = await supabase
        .from("download_jobs")
        .select("*")
        .eq("job_type", "ra_scraping")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) return [];
      return (data ?? []).map((r) => ({
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
