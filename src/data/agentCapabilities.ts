/**
 * DAL — agent_capabilities
 *
 * Capacità per-agente editabili dal Prompt Lab:
 * tool whitelist/blacklist, timeout, concorrenza, modello preferito,
 * modalità di esecuzione. NON sostituisce gli hard guards di sicurezza.
 */
import { supabase } from "@/integrations/supabase/client";

export type AgentExecutionMode = "autonomous" | "supervised" | "read_only";

export interface AgentCapabilities {
  id: string;
  agent_id: string;
  user_id: string;
  allowed_tools: string[];
  blocked_tools: string[];
  approval_required_tools: string[];
  max_concurrent_tools: number;
  step_timeout_ms: number;
  max_iterations: number;
  max_tokens_per_call: number;
  temperature: number;
  preferred_model: string | null;
  execution_mode: AgentExecutionMode;
  notes: string | null;
  updated_at: string;
}

const SELECT_COLS =
  "id, agent_id, user_id, allowed_tools, blocked_tools, approval_required_tools, max_concurrent_tools, step_timeout_ms, max_iterations, max_tokens_per_call, temperature, preferred_model, execution_mode, notes, updated_at";

export async function listAgentCapabilities(): Promise<AgentCapabilities[]> {
  const { data, error } = await supabase
    .from("agent_capabilities")
    .select(SELECT_COLS)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as AgentCapabilities[];
}

export async function getAgentCapabilities(agentId: string): Promise<AgentCapabilities | null> {
  const { data, error } = await supabase
    .from("agent_capabilities")
    .select(SELECT_COLS)
    .eq("agent_id", agentId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as unknown as AgentCapabilities | null;
}

export async function updateAgentCapabilities(
  id: string,
  patch: Partial<Omit<AgentCapabilities, "id" | "agent_id" | "user_id" | "updated_at">>,
): Promise<void> {
  const { error } = await supabase
    .from("agent_capabilities")
    .update(patch as never)
    .eq("id", id);
  if (error) throw error;
}