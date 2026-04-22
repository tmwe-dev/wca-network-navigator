/**
 * workPlansHandler.ts - Work plan-related tool handlers
 * Handles: create, list
 */

import { supabase } from "./supabaseClient.ts";

interface WorkPlanStep {
  title: string;
  description?: string;
  status?: string;
}

export async function handleCreateWorkPlan(
  args: Record<string, unknown>,
  userId: string
): Promise<unknown> {
  const rawSteps = (args.steps as WorkPlanStep[] || []).map((s: WorkPlanStep, i: number) => ({
    index: i,
    title: s.title || `Step ${i + 1}`,
    description: s.description || "",
    status: "pending",
  }));
  const { data, error } = await supabase
    .from("ai_work_plans")
    .insert({
      user_id: userId,
      title: String(args.title),
      description: String(args.description || ""),
      steps: rawSteps as unknown as Record<string, unknown>[],
      status: "active",
      tags: (args.tags || []) as string[],
    })
    .select("id, title")
    .single();
  if (error) return { error: error.message };
  return { success: true, plan_id: data.id, title: data.title, total_steps: rawSteps.length };
}

export async function handleListWorkPlans(
  args: Record<string, unknown>,
  userId: string
): Promise<unknown> {
  let query = supabase
    .from("ai_work_plans")
    .select("id, title, description, status, current_step, steps, tags, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(Number(args.limit) || 20);
  if (args.status) query = query.eq("status", args.status);
  const { data, error } = await query;
  if (error) return { error: error.message };
  const plans = (data || []).map(
    (p: {
      id: string;
      title: string;
      description: string | null;
      status: string;
      current_step: number;
      steps: unknown;
      tags: string[];
      created_at: string;
    }) => ({
      ...p,
      total_steps: Array.isArray(p.steps) ? p.steps.length : 0,
      completed_steps: Array.isArray(p.steps)
        ? (p.steps as WorkPlanStep[]).filter((s) => s.status === "completed").length
        : 0,
    })
  );
  return { count: plans.length, plans };
}
