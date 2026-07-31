/**
 * DAL — email_prompts per AI Lab (senza filtro is_active).
 */
import { supabase } from "@/integrations/supabase/client";

export interface EmailPromptForLabRow {
  readonly id: string;
  readonly title: string;
  readonly instructions: string | null;
  readonly is_active: boolean | null;
  readonly scope: string;
}

export async function findEmailPromptsForLab(limit = 20): Promise<EmailPromptForLabRow[]> {
  const { data, error } = await supabase
    .from("email_prompts")
    .select("id, title, instructions, is_active, scope")
    .order("priority", { ascending: false })
    .limit(limit);
  if (error) return [];
  return data ?? [];
}
