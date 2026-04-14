/**
 * DAL — interactions (partner interactions)
 */
import { supabase } from "@/integrations/supabase/client";

export async function createInteraction(interaction: Record<string, unknown>) {
  const { error } = await supabase.from("interactions").insert(interaction);
  if (error) throw error;
}
