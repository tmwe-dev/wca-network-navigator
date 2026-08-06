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

export interface PartnerInteractionRow {
  id: string;
  interaction_type: string;
  subject: string | null;
  notes: string | null;
  interaction_date: string | null;
  created_at: string;
}

/** Interazioni partner per il drawer contatto (Circuito di Attesa). */
export async function findInteractionsForPartnerRecord(
  partnerId: string,
  limit = 20,
): Promise<PartnerInteractionRow[]> {
  const { data } = await supabase
    .from("interactions")
    .select("*")
    .eq("partner_id", partnerId)
    .order("interaction_date", { ascending: false })
    .limit(limit);
  return (data ?? []) as unknown as PartnerInteractionRow[];
}
