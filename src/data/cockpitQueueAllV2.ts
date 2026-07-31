/**
 * DAL — cockpit_queue globale (tutti gli utenti, per la logica Cockpit V2).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type CockpitQueueRow = Database["public"]["Tables"]["cockpit_queue"]["Row"];

export async function findCockpitQueueAll(limit = 100): Promise<CockpitQueueRow[]> {
  const { data, error } = await supabase
    .from("cockpit_queue")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return data ?? [];
}
