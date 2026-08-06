/**
 * DAL — ai_work_plans
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { isRecord } from "@/lib/jsonGuards";

type WorkPlanInsert = Database["public"]["Tables"]["ai_work_plans"]["Insert"];
type WorkPlanUpdate = Database["public"]["Tables"]["ai_work_plans"]["Update"];

export async function findWorkPlans(userId: string, tags?: string[]) {
  let q = supabase.from("ai_work_plans").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  if (tags?.length) q = q.contains("tags", tags);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function createWorkPlan(plan: WorkPlanInsert) {
  const { data, error } = await supabase.from("ai_work_plans").insert(plan).select().single();
  if (error) throw error;
  return data;
}

export async function updateWorkPlan(id: string, updates: WorkPlanUpdate) {
  const { error } = await supabase.from("ai_work_plans").update(updates).eq("id", id);
  if (error) throw error;
}

export async function deleteWorkPlan(id: string) {
  const { error } = await supabase.from("ai_work_plans").delete().eq("id", id);
  if (error) throw error;
}

export async function findActiveWorkPlans(
  userId: string,
  select = "id, title, status, steps, current_step, tags",
  limit = 5,
) {
  const { data, error } = await supabase
    .from("ai_work_plans")
    .select(select)
    .eq("user_id", userId)
    .in("status", ["running", "paused"])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export interface StaffWorkPlanJobRow {
  id: string;
  title: string;
  status: string;
  created_at: string;
  current_step: number;
  steps: Record<string, unknown>;
}

/** Job (ai_work_plans) recenti per l'overview Staff/Knowledge Base, senza filtro utente. */
export async function findRecentWorkPlansOverview(limit = 20): Promise<StaffWorkPlanJobRow[]> {
  return findRecentWorkPlanJobs(limit);
}

/** Ultimi job ai_work_plans per la vista Staff Direzionale V2. */
export async function findRecentWorkPlanJobs(limit = 20): Promise<StaffWorkPlanJobRow[]> {
  const { data, error } = await supabase
    .from("ai_work_plans")
    .select("id, title, status, created_at, current_step, steps")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title ?? "",
    status: row.status ?? "",
    created_at: row.created_at ?? "",
    current_step: row.current_step ?? 0,
    steps: isRecord(row.steps) ? row.steps : {},
  }));
}
