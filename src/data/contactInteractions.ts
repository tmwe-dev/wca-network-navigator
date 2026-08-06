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

export interface ContactInteractionRecordRow {
  id: string;
  contact_id: string;
  interaction_type: string;
  title: string;
  description: string | null;
  outcome: string | null;
  created_by: string | null;
  created_at: string;
}

/** Interazioni contatto per il drawer (Circuito di Attesa), limitate. */
export async function findContactInteractionsForRecord(
  contactId: string,
  limit = 20,
): Promise<ContactInteractionRecordRow[]> {
  const { data } = await supabase
    .from("contact_interactions")
    .select("id, contact_id, interaction_type, title, description, outcome, created_by, created_at")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export interface ContactInteractionTimelineRow {
  id: string;
  interaction_type: string;
  title: string;
  description: string | null;
  outcome: string | null;
  created_at: string;
}

/** Interazioni contatto paginate per la timeline (range-based). */
export async function findContactInteractionsRange(
  contactId: string,
  from: number,
  to: number,
): Promise<ContactInteractionTimelineRow[]> {
  const { data } = await supabase
    .from("contact_interactions")
    .select("id, interaction_type, title, description, outcome, created_at")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false })
    .range(from, to);
  return data ?? [];
}
