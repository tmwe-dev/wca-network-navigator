/**
 * DAL — agent_tasks
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AgentTaskInsert = Database["public"]["Tables"]["agent_tasks"]["Insert"];
type AgentTaskDbRow = Database["public"]["Tables"]["agent_tasks"]["Row"];

export async function countCompletedAgentTasks() {
  const { count, error } = await supabase
    .from("agent_tasks")
    .select("id", { count: "planned", head: true })
    .eq("status", "completed");
  if (error) throw error;
  return count ?? 0;
}

export async function findAgentTasksByUser(userId: string, statuses: string[], select = "agent_id, status") {
  const { data, error } = await supabase
    .from("agent_tasks")
    .select(select)
    .eq("user_id", userId)
    .in("status", statuses)
    .returns<Array<Record<string, unknown>>>();
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
  return (data ?? []).map(toAgentTaskRow);
}

function toAgentTaskRow(row: AgentTaskDbRow): AgentTaskRow {
  return {
    id: row.id,
    agent_id: row.agent_id,
    task_type: row.task_type,
    status: row.status,
    description: row.description,
    result_summary: row.result_summary,
    created_at: row.created_at,
    completed_at: row.completed_at,
  };
}

/** Insert su agent_tasks (usato dai tool Command / harmonize orchestrator). */
export async function insertAgentTask(task: AgentTaskInsert): Promise<void> {
  const { error } = await supabase.from("agent_tasks").insert(task);
  if (error) throw error;
}

/** Insert su agent_tasks che ritorna la riga creata. */
export async function insertAgentTaskReturning(task: AgentTaskInsert): Promise<AgentTaskDbRow> {
  const { data, error } = await supabase.from("agent_tasks").insert(task).select().single();
  if (error) throw error;
  return data;
}

export interface ProposedAgentTaskRow {
  readonly id: string;
  readonly agent_id: string | null;
  readonly task_type: string | null;
  readonly description: string | null;
  readonly status: string;
  readonly created_at: string;
}

/** Task agente in stato "proposed" o "pending" (Coda AI). */
export async function findProposedOrPendingAgentTasks(limit = 100): Promise<ProposedAgentTaskRow[]> {
  const { data, error } = await supabase
    .from("agent_tasks")
    .select("id, agent_id, task_type, description, status, created_at")
    .in("status", ["proposed", "pending"])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/** Numero di task pending/proposed di un utente, per il badge task count. */
export async function countPendingAgentTasksForUser(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("agent_tasks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", ["pending", "proposed"]);
  if (error) return 0;
  return count ?? 0;
}

export interface PendingAgentTaskFullRow {
  id: string;
  agent_id: string;
  task_type: string;
  description: string;
  status: string;
  target_filters: Record<string, unknown>;
  created_at: string;
  scheduled_at: string | null;
  result_summary: string | null;
}

/** Task in stato "proposed"/"pending" con tutte le colonne (AgentTasksPage). */
export async function findPendingAgentTasksFull(limit = 200): Promise<PendingAgentTaskFullRow[]> {
  const { data, error } = await supabase
    .from("agent_tasks")
    .select("*")
    .in("status", ["proposed", "pending"])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...toAgentTaskRow(row),
    target_filters:
      row.target_filters !== null && typeof row.target_filters === "object" && !Array.isArray(row.target_filters)
        ? (row.target_filters as Record<string, unknown>)
        : {},
    scheduled_at: row.scheduled_at,
  }));
}

/** Aggiorna lo stato di un agent_task (approvazione/rifiuto in AgentTasksPage). */
export async function updateAgentTaskStatus(id: string, status: string, startedAt?: string): Promise<void> {
  const { error } = await supabase.from("agent_tasks").update({ status, started_at: startedAt }).eq("id", id);
  if (error) throw error;
}
