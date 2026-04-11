/**
 * DAL — operative_prompts
 */
import { supabase } from "@/integrations/supabase/client";

export async function findOperativePrompts(userId: string, select = "id, name, objective, priority, tags, is_active") {
  const { data, error } = await supabase.from("operative_prompts").select(select).eq("user_id", userId).order("priority", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
