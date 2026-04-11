/**
 * useOperationsV2 — Operations center (download queue, alias, batch jobs)
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface DownloadQueueItem {
  readonly id: string;
  readonly countryCode: string;
  readonly countryName: string;
  readonly networkName: string;
  readonly status: string;
  readonly totalProcessed: number;
  readonly totalFound: number;
  readonly priority: number;
}

export function useOperationsV2() {
  return useQuery({
    queryKey: ["v2", "operations-queue"],
    queryFn: async (): Promise<readonly DownloadQueueItem[]> => {
      const { data, error } = await supabase
        .from("download_queue")
        .select("*")
        .order("priority", { ascending: false });
      if (error) return [];
      return (data ?? []).map((r) => ({
        id: r.id,
        countryCode: r.country_code,
        countryName: r.country_name,
        networkName: r.network_name,
        status: r.status,
        totalProcessed: r.total_processed,
        totalFound: r.total_found,
        priority: r.priority,
      }));
    },
  });
}
