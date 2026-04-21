/**
 * DAL — operative_prompts
 */
import { supabase } from "@/integrations/supabase/client";

export async function findOperativePrompts(userId: string, select = "id, name, objective, priority, tags, is_active") {
  const { data, error } = await supabase.from("operative_prompts").select(select).eq("user_id", userId).order("priority", { ascending: false });
  if (error) throw error;
  return data ?? [];
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

export async function findOperativePromptsFull(userId: string): Promise<OperativePromptFull[]> {
  const { data, error } = await supabase
    .from("operative_prompts")
    .select("id, user_id, name, context, objective, procedure, criteria, examples, tags, priority, is_active")
    .eq("user_id", userId)
    .order("priority", { ascending: false });
  if (error) throw error;
  return (data ?? []) as OperativePromptFull[];
}

export async function updateOperativePrompt(id: string, patch: Partial<OperativePromptFull>): Promise<void> {
  const { error } = await supabase.from("operative_prompts").update(patch).eq("id", id);
  if (error) throw error;
}
