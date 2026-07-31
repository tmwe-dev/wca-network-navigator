/**
 * DAL — agent_tasks
 */
import { supabase } from "@/integrations/supabase/client";

export async function countCompletedAgentTasks() {
  const { count, error } = await supabase.from("agent_tasks").select("id", { count: "planned", head: true }).eq("status", "completed");
  if (error) throw error;
  return count ?? 0;
}

export async function findAgentTasksByUser(userId: string, statuses: string[], select = "agent_id, status") {
  const { data, error } = await supabase.from("agent_tasks").select(select).eq("user_id", userId).in("status", statuses);
  if (error) throw error;
  return data ?? [];
}

export interface AgentTaskRow {
  readonly id: string;
  readonly agent_id: string;
  readonly task_type: string;
  readonly status: string;
  readonly description: string;
  readonly result_summary: string | null;
  readonly created_at: string;
  readonly completed_at: string | null;
}

export async function findAgentTasksList(agentId?: string, limit = 100): Promise<AgentTaskRow[]> {
  let q = supabase.from("agent_tasks").select("*").order("created_at", { ascending: false }).limit(limit);
  if (agentId) q = q.eq("agent_id", agentId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as AgentTaskRow[];
}
