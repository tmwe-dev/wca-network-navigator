/**
 * DAL — ai_work_plans
 */
import { supabase } from "@/integrations/supabase/client";

export async function findWorkPlans(userId: string, tags?: string[]) {
  let q = supabase.from("ai_work_plans").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  if (tags?.length) q = q.contains("tags", tags);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function createWorkPlan(plan: Record<string, unknown>) {
  const { data, error } = await supabase.from("ai_work_plans").insert(plan).select().single();
  if (error) throw error;
  return data;
}

export async function updateWorkPlan(id: string, updates: Record<string, unknown>) {
  const { error } = await supabase.from("ai_work_plans").update(updates).eq("id", id);
  if (error) throw error;
}

export async function deleteWorkPlan(id: string) {
  const { error } = await supabase.from("ai_work_plans").delete().eq("id", id);
  if (error) throw error;
}

export async function findActiveWorkPlans(userId: string, select = "id, title, status, steps, current_step, tags", limit = 5) {
  const { data, error } = await supabase.from("ai_work_plans").select(select).eq("user_id", userId).in("status", ["running", "paused"]).order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return data ?? [];
}
