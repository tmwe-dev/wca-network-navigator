/**
 * DAL — interactions (partner interactions)
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type InteractionInsert = Database["public"]["Tables"]["interactions"]["Insert"];

export async function createInteraction(interaction: InteractionInsert) {
  const { error } = await supabase.from("interactions").insert(interaction);
  if (error) throw error;
}
