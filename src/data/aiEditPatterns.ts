import { supabase } from "@/integrations/supabase/client";

export interface EditPatternInsert {
  email_type?: string;
  country_code?: string;
  channel?: string;
  hook_original?: string;
  hook_final?: string;
  cta_original?: string;
  cta_final?: string;
  tone_delta?: string;
  length_delta_percent?: number;
  formality_shift?: string;
  persuasion_pattern?: string;
  significance?: string;
}

export async function insertEditPattern(pattern: EditPatternInsert): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await (supabase as unknown as { from(table: string): ReturnType<typeof supabase.from> })
    .from("ai_edit_patterns")
    .insert({ ...pattern, user_id: user.id });
}
