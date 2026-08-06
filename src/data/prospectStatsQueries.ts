/** DAL — Queries for useProspectStats. */
import { supabase } from "@/integrations/supabase/client";

export async function countAllProspects(): Promise<number> {
  const { count, error } = await supabase.from("prospects").select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

export interface ProspectAtecoRow {
  codice_ateco: string | null;
  descrizione_ateco: string | null;
  email: string | null;
  pec: string | null;
  phone: string | null;
  fatturato: number | null;
}

export async function getAllProspectsForAtecoGroups(): Promise<ProspectAtecoRow[]> {
  const { data, error } = await supabase
    .from("prospects")
    .select("codice_ateco, descrizione_ateco, email, pec, phone, fatturato");
  if (error) throw error;
  return data ?? [];
}
