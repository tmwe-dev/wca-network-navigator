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

/** Job di una campagna (batch). */
export async function findCampaignJobsByBatch<T>(batchId: string): Promise<T[]> {
  const { data, error } = await supabase
    .from("campaign_jobs")
    .select("*")
    .eq("batch_id", batchId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as T[];
}

export async function updateCampaignJobById(id: string, updates: Record<string, unknown>): Promise<void> {
  const { error } = await supabase
    .from("campaign_jobs")
    .update(updates as Database["public"]["Tables"]["campaign_jobs"]["Update"])
    .eq("id", id);
  if (error) throw error;
}

export async function deleteCampaignJobsByIds(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.from("campaign_jobs").delete().in("id", ids);
  if (error) throw error;
}

/** Ultimi campaign_jobs (per dashboard "Coda"). */
export async function findRecentCampaignJobs<T = Record<string, unknown>>(limit = 50): Promise<T[]> {
  const { data, error } = await supabase
    .from("campaign_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as T[];
}
