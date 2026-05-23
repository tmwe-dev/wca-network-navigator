/**
 * DAL — Brain (cervello unico, sola lettura)
 *
 * F5 (2026-05-23): legge agenti, capabilities, persona e prompt operativi
 * usando la view `v_agent_full` creata in F1 e la tabella `operative_prompts`.
 * Non scrive nulla: la pagina /v2/brain è read-only finché non validiamo il
 * comportamento nel tempo.
 */
import { supabase } from "@/integrations/supabase/client";
import { untypedFrom } from "@/lib/supabaseUntyped";

export interface BrainAgentRow {
  agent_id: string;
  user_id: string | null;
  name: string | null;
  role: string | null;
  avatar_emoji: string | null;
  status: string | null;
  system_prompt: string | null;
  tone: string | null;
  custom_tone_prompt: string | null;
  language: string | null;
  style_rules: string[] | null;
  vocabulary_do: string[] | null;
  vocabulary_dont: string[] | null;
  signature_template: string | null;
  allowed_tools: string[] | null;
  blocked_tools: string[] | null;
  approval_required_tools: string[] | null;
  preferred_model: string | null;
  execution_mode: string | null;
  has_capabilities: boolean | null;
  has_persona: boolean | null;
}

export async function listBrainAgents(): Promise<BrainAgentRow[]> {
  const { data, error } = await untypedFrom("v_agent_full")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as BrainAgentRow[];
}

export interface BrainPromptRow {
  id: string;
  name: string;
  context: string;
  objective: string | null;
  priority: number | null;
  is_active: boolean | null;
  tags: string[] | null;
  updated_at: string;
}

/**
 * Carica i prompt operativi attivi filtrati per uno o più context.
 * Usato dal drawer Brain per mostrare le "regole vive" del canale scelto.
 */
export async function listBrainPrompts(contexts: readonly string[]): Promise<BrainPromptRow[]> {
  if (contexts.length === 0) return [];
  const { data, error } = await supabase
    .from("operative_prompts")
    .select("id, name, context, objective, priority, is_active, tags, updated_at")
    .in("context", contexts as string[])
    .eq("is_active", true)
    .is("deprecated_at", null)
    .order("priority", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(60);
  if (error) throw error;
  return (data ?? []) as BrainPromptRow[];
}