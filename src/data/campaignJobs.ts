/**
 * DAL — campaign_jobs
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { emitBusyPartnersChanged } from "@/v2/hooks/useBusyPartners";

type CampaignJobInsert = Database["public"]["Tables"]["campaign_jobs"]["Insert"];

export async function insertCampaignJobs(jobs: CampaignJobInsert[]) {
  const { error } = await supabase.from("campaign_jobs").insert(jobs);
  if (error) throw error;
  emitBusyPartnersChanged();
}
