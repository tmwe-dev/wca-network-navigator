/**
 * DAL — contact_interactions
 */
import { supabase } from "@/integrations/supabase/client";

export async function insertContactInteraction(interaction: Record<string, unknown>) {
  const { error } = await supabase.from("contact_interactions").insert(interaction as any);
  if (error) throw error;
}
