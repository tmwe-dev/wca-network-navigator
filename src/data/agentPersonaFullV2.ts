/**
 * DAL — agent_personas (forma completa usata da useAgentPersona).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";

export type AgentPersonaFullRow = Database["public"]["Tables"]["agent_personas"]["Row"];
type AgentPersonaFullUpsert = Database["public"]["Tables"]["agent_personas"]["Insert"];

/**
 * I chiamanti modellano i campi jsonb come `Record<string, unknown>`:
 * qui si accettano quelle forme e si normalizzano a `Json` al confine DAL.
 */
export type AgentPersonaFullUpsertInput = Omit<AgentPersonaFullUpsert, "kb_filter" | "example_messages"> & {
  kb_filter?: Record<string, unknown> | Json;
  example_messages?: Record<string, unknown> | Json;
};

function toJson(value: Record<string, unknown> | Json | undefined): Json | undefined {
  if (value === undefined) return undefined;
  const raw: unknown = value;
  return raw as Json;
}

export async function getAgentPersonaFull(agentId: string): Promise<AgentPersonaFullRow | null> {
  const { data, error } = await supabase.from("agent_personas").select("*").eq("agent_id", agentId).maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function upsertAgentPersonaFull(payload: AgentPersonaFullUpsertInput): Promise<void> {
  const { kb_filter, example_messages, ...rest } = payload;
  const row: AgentPersonaFullUpsert = {
    ...rest,
    ...(kb_filter !== undefined ? { kb_filter: toJson(kb_filter) } : {}),
    ...(example_messages !== undefined ? { example_messages: toJson(example_messages) } : {}),
  };
  const { error } = await supabase.from("agent_personas").upsert(row, { onConflict: "agent_id" });
  if (error) throw error;
}
