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