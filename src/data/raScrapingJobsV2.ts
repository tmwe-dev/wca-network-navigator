/**
 * DAL — download_jobs filtrati per job_type "ra_scraping".
 */
import { supabase } from "@/integrations/supabase/client";

export interface RAScrapingJobRow {
  readonly id: string;
  readonly status: string;
  readonly country_code: string;
  readonly country_name: string;
  readonly network_name: string;
  readonly total_count: number;
  readonly current_index: number;
  readonly created_at: string;
}

export async function findRAScrapingJobs(limit = 20): Promise<RAScrapingJobRow[]> {
  const { data, error } = await supabase
    .from("download_jobs")
    .select("*")
    .eq("job_type", "ra_scraping")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return data ?? [];
}
