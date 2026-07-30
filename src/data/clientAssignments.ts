/**
 * DAL — client_assignments
 */
import { supabase } from "@/integrations/supabase/client";

export async function findClientAssignmentsByUser(userId: string, select = "agent_id") {
  const { data, error } = await supabase.from("client_assignments").select(select).eq("user_id", userId);
  if (error) throw error;
  return data ?? [];
}

/** Verifica se esiste già un assegnamento per (source_id, user_id). */
export async function findClientAssignment(sourceId: string, userId: string): Promise<{ id: string } | null> {
  const { data } = await supabase
    .from("client_assignments")
    .select("id")
    .eq("source_id", sourceId)
    .eq("user_id", userId)
    .maybeSingle();
  return data ?? null;
}

export interface ClientAssignmentInsert {
  source_id: string;
  source_type: string;
  agent_id: string;
  manager_id: string | null;
  user_id: string;
}

/** Crea un assegnamento agente/manager. Ritorna il messaggio d'errore se fallisce. */
export async function insertClientAssignment(row: ClientAssignmentInsert): Promise<string | null> {
  const { error } = await supabase.from("client_assignments").insert(row);
  return error?.message ?? null;
}
