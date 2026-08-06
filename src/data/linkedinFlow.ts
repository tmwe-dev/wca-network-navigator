/**
 * DAL — linkedin_flow_jobs + linkedin_flow_items
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type FlowJobInsert = Database["public"]["Tables"]["linkedin_flow_jobs"]["Insert"];
type FlowItemInsert = Database["public"]["Tables"]["linkedin_flow_items"]["Insert"];

export async function createLinkedInFlowJob(job: FlowJobInsert) {
  const { data, error } = await supabase.from("linkedin_flow_jobs").insert(job).select().single();
  if (error) throw error;
  return data;
}

export async function updateLinkedInFlowJob(
  id: string,
  updates: Partial<Database["public"]["Tables"]["linkedin_flow_jobs"]["Update"]>,
) {
  const { error } = await supabase.from("linkedin_flow_jobs").update(updates).eq("id", id);
  if (error) throw error;
}

export async function getLinkedInFlowJobField(id: string, field: string) {
  const { data, error } = await supabase.from("linkedin_flow_jobs").select(field).eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function findPendingFlowItems(jobId: string) {
  const { data, error } = await supabase
    .from("linkedin_flow_items")
    .select("*")
    .eq("job_id", jobId)
    .eq("status", "pending")
    .order("position", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function updateLinkedInFlowItem(
  id: string,
  updates: Partial<Database["public"]["Tables"]["linkedin_flow_items"]["Update"]>,
) {
  const { error } = await supabase.from("linkedin_flow_items").update(updates).eq("id", id);
  if (error) throw error;
}

export async function insertLinkedInFlowItems(items: FlowItemInsert[]) {
  const { error } = await supabase.from("linkedin_flow_items").insert(items);
  if (error) throw error;
}

/** Conteggio item di un job già processati (completed | error). */
export async function countProcessedFlowItems(jobId: string): Promise<number> {
  const { count } = await supabase
    .from("linkedin_flow_items")
    .select("*", { count: "exact", head: true })
    .eq("job_id", jobId)
    .in("status", ["completed", "error"]);
  return count || 0;
}

/** Conteggio item di un job in uno specifico stato. */
export async function countFlowItemsByStatus(jobId: string, status: string): Promise<number> {
  const { count } = await supabase
    .from("linkedin_flow_items")
    .select("*", { count: "exact", head: true })
    .eq("job_id", jobId)
    .eq("status", status);
  return count || 0;
}
