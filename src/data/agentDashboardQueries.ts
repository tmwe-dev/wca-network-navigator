/** DAL — Queries for useAgentDashboard. */
import { supabase } from "@/integrations/supabase/client";

export interface DashboardAgentRow {
  id: string;
  name: string;
  role: string;
  avatar_emoji: string;
  is_active: boolean;
}

export async function getActiveAgentsForUser(userId: string): Promise<DashboardAgentRow[]> {
  const { data } = await supabase
    .from("agents")
    .select("id, name, role, avatar_emoji, is_active")
    .is("deleted_at", null)
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at");
  return (data ?? []) as DashboardAgentRow[];
}

export interface DashboardAgentTaskRow {
  id: string;
  agent_id: string;
  task_type: string;
  description: string;
  status: string;
  result_summary: string | null;
  execution_log: Array<Record<string, unknown>>;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  target_filters: unknown;
}

export async function getAgentTasksForUser(userId: string): Promise<DashboardAgentTaskRow[]> {
  const { data } = await supabase
    .from("agent_tasks")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);
  return (data ?? []) as unknown as DashboardAgentTaskRow[];
}
