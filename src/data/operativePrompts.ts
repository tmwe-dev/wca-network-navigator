/**
 * DAL — operative_prompts
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export async function findOperativePrompts(userId: string, select = "id, name, objective, priority, tags, is_active") {
  const { data, error } = await supabase
    .from("operative_prompts")
    .select(select)
    .order("priority", { ascending: false })
    .returns<Array<Record<string, unknown>>>();
  if (error) throw error;
  return data ?? [];
}

/** Opzione minimale per i selettori di prompt (id + nome). */
export interface OperativePromptOption {
  id: string;
  name: string;
}

/** Elenco prompt come opzioni: le righe senza id/nome stringa sono scartate. */
export async function findOperativePromptOptions(userId: string): Promise<OperativePromptOption[]> {
  const rows = await findOperativePrompts(userId, "id, name");
  const out: OperativePromptOption[] = [];
  for (const r of rows) {
    if (typeof r.id === "string" && typeof r.name === "string") out.push({ id: r.id, name: r.name });
  }
  return out;
}

export interface OperativePromptFull {
  id: string;
  user_id: string;
  name: string;
  context: string | null;
  objective: string | null;
  procedure: string | null;
  criteria: string | null;
  examples: string | null;
  tags: string[] | null;
  priority: number | null;
  is_active: boolean | null;
}

export async function findOperativePromptsFull(_userId: string): Promise<OperativePromptFull[]> {
  const { data, error } = await supabase
    .from("operative_prompts")
    .select("id, user_id, name, context, objective, procedure, criteria, examples, tags, priority, is_active")
    .order("priority", { ascending: false });
  if (error) throw error;
  return (data ?? []) as OperativePromptFull[];
}

export async function updateOperativePrompt(
  id: string,
  patch: Database["public"]["Tables"]["operative_prompts"]["Update"],
): Promise<void> {
  const { error } = await supabase.from("operative_prompts").update(patch).eq("id", id);
  if (error) throw error;
}
