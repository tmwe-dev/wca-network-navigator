/**
 * DAL — agent_personas
 */
import { supabase } from "@/integrations/supabase/client";

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
  const { error } = await supabase.from("agent_personas").update(patch as never).eq("id", id);
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
  const payload = { ...input, user_id: userId } as Record<string, unknown>;
  const { error } = await supabase
    .from("agent_personas")
    .upsert(payload as never, { onConflict: "agent_id" });
  if (error) throw error;
}