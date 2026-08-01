import { supabase } from "@/integrations/supabase/client";
import type { ContactInteraction } from "./types";

export async function findContactInteractions(
  contactId: string
): Promise<ContactInteraction[]> {
  const { data, error } = await supabase
    .from("contact_interactions")
    .select("*")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ContactInteraction[];
}

export async function createContactInteraction(interaction: {
  contact_id: string;
  interaction_type: string;
  title: string;
  description?: string;
  outcome?: string;
}) {
  const { error: iError } = await supabase
    .from("contact_interactions")
    .insert(interaction);
  if (iError) throw iError;

  await supabase.rpc("increment_contact_interaction", {
    p_contact_id: interaction.contact_id,
  });
}

export async function findBusinessCardForContact(contactId: string) {
  const { data, error } = await supabase
    .from("business_cards")
    .select("photo_url, event_name, met_at, location")
    .eq("matched_contact_id", contactId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}
