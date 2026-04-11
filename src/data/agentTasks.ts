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
