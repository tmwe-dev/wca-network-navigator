/**
 * DAL — agents
 * Centralizes all agents queries and cache invalidation.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { QueryClient } from "@tanstack/react-query";

export type AgentRow = Database["public"]["Tables"]["agents"]["Row"];
export type AgentInsert = Database["public"]["Tables"]["agents"]["Insert"];
export type AgentUpdate = Database["public"]["Tables"]["agents"]["Update"];

export type Agent = Omit<AgentRow, "stats" | "assigned_tools" | "knowledge_base"> & {
  stats: { tasks_completed: number; emails_sent: number; calls_made: number };
  assigned_tools: string[];
  knowledge_base: Record<string, unknown>[];
};

const QUERY_KEY = ["agents"] as const;

// ── Reads ──

/**
 * Restituisce TUTTI gli agenti del sistema (visibilità globale, no isolamento per user).
 * Il parametro userId è mantenuto per retrocompatibilità ma ignorato.
 */
export async function findAgents(_userId?: string): Promise<Agent[]> {
  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Agent[];
}

export async function findActiveAgents(fields = "name, role, avatar_emoji, is_active, stats, territory_codes"): Promise<Array<Record<string, unknown>>> {
  const { data, error } = await supabase
    .from("agents")
    .select(fields)
    .eq("is_active", true);
  if (error) throw error;
  return (data ?? []) as unknown as Array<Record<string, unknown>>;
}

export async function getAgentById(id: string): Promise<Agent | null> {
  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Agent | null;
}

// ── Writes ──

export async function createAgent(agent: AgentInsert): Promise<Agent> {
  const { data, error } = await supabase
    .from("agents")
    .insert(agent)
    .select()
    .single();
  if (error) throw error;
  return data as Agent;
}

export async function updateAgent(id: string, updates: AgentUpdate): Promise<void> {
  const { error } = await supabase
    .from("agents")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteAgent(id: string): Promise<void> {
  const { error } = await supabase
    .from("agents")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function countActiveAgents() {
  const { count, error } = await supabase.from("agents").select("id", { count: "planned", head: true }).eq("is_active", true);
  if (error) throw error;
  return count ?? 0;
}

export async function findAgentsByUser(userId: string, select = "id, name, role, avatar_emoji, is_active, stats"): Promise<Array<Record<string, unknown>>> {
  const { data, error } = await supabase.from("agents").select(select).eq("user_id", userId);
  if (error) throw error;
  return (data ?? []) as unknown as Array<Record<string, unknown>>;
}

export async function findAgentByUserAndName(userId: string, name: string) {
  const { data } = await supabase.from("agents").select("id").eq("user_id", userId).eq("name", name).maybeSingle();
  return data;
}

// ── Cache ──

export function invalidateAgents(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: QUERY_KEY });
}
