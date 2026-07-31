/**
 * DAL — Acquisition pipeline stats (directory_cache + download_jobs)
 */
import { supabase } from "@/integrations/supabase/client";

export interface AcquisitionCacheRow {
  readonly country_code: string;
  readonly total_results: number | null;
}

export async function fetchAcquisitionCacheRows(): Promise<AcquisitionCacheRow[]> {
  const { data } = await supabase.from("directory_cache").select("country_code, total_results");
  return data ?? [];
}

export async function fetchActiveDownloadJobs(): Promise<Array<{ status: string }>> {
  const { data } = await supabase.from("download_jobs").select("status").in("status", ["running", "paused"]);
  return data ?? [];
}
