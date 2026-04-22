/**
 * agentHandler.ts - UI actions and agent management tool handlers
 * Handles: UI actions, agent tasks, team status
 */

import { supabase, escapeLike } from "./supabaseClient.ts";

interface AgentRow {
  id: string;
  name: string;
  role: string;
  is_active: boolean;
  stats: unknown;
  avatar_emoji: string;
  updated_at: string;
}

interface AgentTaskRow {
  id: string;
  agent_id: string;
  description: string;
  status: string;
  task_type: string;
  created_at: string;
  result_summary: string | null;
}

export async function handleExecuteUIAction(
  args: Record<string, unknown>
): Promise<unknown> {
  const action = String(args.action || "toast");
  const target = String(args.target || "");
  return { success: true, ui_action: { action, target, params: args.params || {} } };
}

export async function handleCreateAgentTask(
  args: Record<string, unknown>,
  userId: string
): Promise<unknown> {
  let agentQuery = supabase
    .from("agents")
    .select("id, name")
    .eq("user_id", userId);
  if (args.agent_name)
    agentQuery = agentQuery.ilike("name", `%${escapeLike(String(args.agent_name))}%`);
  else if (args.agent_role) agentQuery = agentQuery.eq("role", args.agent_role);
  const { data: agents } = await agentQuery.limit(1);
  if (!agents || agents.length === 0) return { error: `Agente non trovato.` };
  const targetAgent = agents[0];
  const { data, error } = await supabase
    .from("agent_tasks")
    .insert({
      agent_id: targetAgent.id,
      user_id: userId,
      task_type: String(args.task_type || "research"),
      description: String(args.description),
      target_filters: (args.target_filters || {}) as Record<string, unknown>,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  return {
    success: true,
    task_id: data.id,
    agent_name: targetAgent.name,
    message: `Task creato per ${targetAgent.name}.`,
  };
}

export async function handleListAgentTasks(
  args: Record<string, unknown>,
  userId: string
): Promise<unknown> {
  let query = supabase
    .from("agent_tasks")
    .select("id, agent_id, task_type, description, status, result_summary, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(Number(args.limit) || 30);
  if (args.status) query = query.eq("status", args.status);
  const { data: tasks, error } = await query;
  if (error) return { error: error.message };
  const agentIds = [...new Set((tasks || []).map((t: AgentTaskRow) => t.agent_id))];
  const { data: agentsData } = await supabase.from("agents").select("id, name").in("id", agentIds);
  const nameMap: Record<string, string> = {};
  for (const a of (agentsData || []) as { id: string; name: string }[]) nameMap[a.id] = a.name;
  let results = (tasks || []).map((t: AgentTaskRow) => ({
    ...t,
    agent_name: nameMap[t.agent_id] || "?",
  }));
  if (args.agent_name)
    results = results.filter((t) =>
      t.agent_name.toLowerCase().includes(String(args.agent_name).toLowerCase())
    );
  return { count: results.length, tasks: results };
}

export async function handleGetTeamStatus(
  userId: string
): Promise<unknown> {
  const { data: agents } = await supabase
    .from("agents")
    .select("id, name, role, is_active, stats, avatar_emoji, updated_at")
    .eq("user_id", userId)
    .order("name");
  if (!agents) return { error: "Nessun agente trovato" };
  const agentIds = agents.map((a: AgentRow) => a.id);
  const { data: tasks } = await supabase
    .from("agent_tasks")
    .select("agent_id, status")
    .in("agent_id", agentIds);
  const taskStats: Record<string, { pending: number; running: number; completed: number; failed: number }> = {};
  for (const t of (tasks || []) as { agent_id: string; status: string }[]) {
    if (!taskStats[t.agent_id])
      taskStats[t.agent_id] = { pending: 0, running: 0, completed: 0, failed: 0 };
    if (taskStats[t.agent_id][t.status as keyof typeof taskStats[string]] !== undefined)
      taskStats[t.agent_id][t.status as keyof typeof taskStats[string]]++;
  }
  return {
    team_size: agents.length,
    active_agents: agents.filter((a: AgentRow) => a.is_active).length,
    agents: agents.map((a: AgentRow) => ({
      name: a.name,
      role: a.role,
      emoji: a.avatar_emoji,
      is_active: a.is_active,
      stats: a.stats,
      tasks: taskStats[a.id] || { pending: 0, running: 0, completed: 0, failed: 0 },
      last_activity: a.updated_at,
    })),
  };
}
