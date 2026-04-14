/**
 * DAL — linkedin_flow_jobs + linkedin_flow_items
 */
import { supabase } from "@/integrations/supabase/client";

export async function createLinkedInFlowJob(job: Record<string, unknown>) {
  const { data, error } = await supabase.from("linkedin_flow_jobs").insert(job as any).select().single();
  if (error) throw error;
  return data;
}

export async function updateLinkedInFlowJob(id: string, updates: Record<string, unknown>) {
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

export async function updateLinkedInFlowItem(id: string, updates: Record<string, unknown>) {
  const { error } = await supabase.from("linkedin_flow_items").update(updates).eq("id", id);
  if (error) throw error;
}

export async function insertLinkedInFlowItems(items: Record<string, unknown>[]) {
  const { error } = await supabase.from("linkedin_flow_items").insert(items);
  if (error) throw error;
}
