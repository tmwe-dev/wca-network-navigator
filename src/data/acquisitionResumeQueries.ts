/** DAL — Queries for useAcquisitionResume. */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type DownloadJobsRow = Database["public"]["Tables"]["download_jobs"]["Row"];

export async function findActiveOrPausedAcquisitionJobs(): Promise<DownloadJobsRow[]> {
  const { data } = await supabase
    .from("download_jobs")
    .select("*")
    .eq("job_type", "acquisition")
    .in("status", ["running", "paused"])
    .order("created_at", { ascending: false })
    .limit(1);
  return (data ?? []) as DownloadJobsRow[];
}

export async function findDirectoryCacheMembers(countryCode: string): Promise<Array<{ members: unknown }>> {
  const { data } = await supabase.from("directory_cache").select("members").eq("country_code", countryCode);
  return (data ?? []) as Array<{ members: unknown }>;
}
