/**
 * DAL — email_prompts (composer templates)
 */
import { supabase } from "@/integrations/supabase/client";

export async function findActiveEmailPrompts(limit = 20) {
  const { data } = await supabase
    .from("email_prompts")
    .select("id, title, instructions, scope")
    .eq("is_active", true)
    .order("priority", { ascending: false })
    .limit(limit);
  return data ?? [];
}
