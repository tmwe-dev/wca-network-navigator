/**
 * DAL — campaign_jobs
 */
import { supabase } from "@/integrations/supabase/client";

export async function insertCampaignJobs(jobs: Array<Record<string, unknown>>) {
  const { error } = await supabase.from("campaign_jobs").insert(jobs as any);
  if (error) throw error;
}
