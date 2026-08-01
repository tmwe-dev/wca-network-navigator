/**
 * DAL — agent_personas
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AgentPersonaUpdate = Database["public"]["Tables"]["agent_personas"]["Update"];

export interface AgentPersona {
  id: string;
  user_id: string;
  agent_id: string;
  tone: string | null;
  custom_tone_prompt: string | null;
  language: string | null;
  style_rules: string[] | null;
  vocabulary_do: string[] | null;
  vocabulary_dont: string[] | null;
  example_messages: unknown;
  signature_template: string | null;
}

export async function findAgentPersonas(userId: string): Promise<AgentPersona[]> {
  const { data, error } = await supabase
    .from("agent_personas")
    .select("id, user_id, agent_id, tone, custom_tone_prompt, language, style_rules, vocabulary_do, vocabulary_dont, example_messages, signature_template")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []) as AgentPersona[];
}

export async function updateAgentPersona(id: string, patch: Partial<AgentPersona>): Promise<void> {
  const { error } = await supabase.from("agent_personas").update(patch as AgentPersonaUpdate).eq("id", id);
  if (error) throw error;
}

/** Get the persona row for a given agent (or null if none). */
export async function getAgentPersonaByAgent(agentId: string): Promise<AgentPersona | null> {
  const { data, error } = await supabase
    .from("agent_personas")
    .select("id, user_id, agent_id, tone, custom_tone_prompt, language, style_rules, vocabulary_do, vocabulary_dont, example_messages, signature_template")
    .eq("agent_id", agentId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as AgentPersona | null;
}

export interface AgentPersonaUpsert {
  agent_id: string;
  tone: string;
  custom_tone_prompt?: string | null;
  language: string;
  style_rules: string[];
  vocabulary_do: string[];
  vocabulary_dont: string[];
  signature_template?: string | null;
}

/** Create or update the persona for an agent. */
export async function upsertAgentPersona(input: AgentPersonaUpsert): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Non autenticato");
  const payload: Database["public"]["Tables"]["agent_personas"]["Insert"] = { ...input, user_id: userId };
  const { error } = await supabase
    .from("agent_personas")
    .upsert(payload, { onConflict: "agent_id" });
  if (error) throw error;
}
/** Update arbitrario della persona di un agente, per agent_id (usato dai tool Command). */
export async function updateAgentPersonaByAgentId(agentId: string, updates: AgentPersonaUpdate): Promise<void> {
  const { error } = await supabase.from("agent_personas").update(updates).eq("agent_id", agentId);
  if (error) throw error;
}
