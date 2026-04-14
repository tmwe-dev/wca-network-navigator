/**
 * DAL — contact_interactions
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type InteractionInsert = Database["public"]["Tables"]["contact_interactions"]["Insert"];

export async function insertContactInteraction(interaction: InteractionInsert) {
  const { error } = await supabase.from("contact_interactions").insert(interaction);
  if (error) throw error;
}
