/**
 * DAL — email_prompts
 */
import { supabase } from "@/integrations/supabase/client";

export async function findActiveEmailPrompts(select = "id, title, scope", limit = 20) {
  const { data, error } = await supabase.from("email_prompts").select(select).eq("is_active", true).order("priority", { ascending: false }).limit(limit);
  if (error) throw error;
  return data ?? [];
}
