/**
 * DAL — email_prompts
 */
import { supabase } from "@/integrations/supabase/client";

export async function findActiveEmailPrompts(select = "id, title, scope", limit = 20) {
  const { data, error } = await supabase.from("email_prompts").select(select).eq("is_active", true).order("priority", { ascending: false }).limit(limit);
  if (error) throw error;
  return data ?? [];
}

export interface EmailPromptFull {
  id: string;
  user_id: string;
  scope: string;
  scope_value: string | null;
  title: string;
  instructions: string | null;
  is_active: boolean | null;
  priority: number | null;
}

export async function findEmailPromptsByScope(userId: string, scope: string): Promise<EmailPromptFull[]> {
  const { data, error } = await supabase
    .from("email_prompts")
    .select("id, user_id, scope, scope_value, title, instructions, is_active, priority")
    .eq("user_id", userId)
    .eq("scope", scope)
    .order("priority", { ascending: false });
  if (error) throw error;
  return (data ?? []) as EmailPromptFull[];
}

export async function updateEmailPrompt(id: string, patch: Partial<EmailPromptFull>): Promise<void> {
  const { error } = await supabase.from("email_prompts").update(patch).eq("id", id);
  if (error) throw error;
}
