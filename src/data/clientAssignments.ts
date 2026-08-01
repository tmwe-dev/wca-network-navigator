/**
 * DAL — client_assignments
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ClientAssignmentRow = Database["public"]["Tables"]["client_assignments"]["Row"];

export async function findClientAssignmentsByUser(userId: string, select = "agent_id") {
  const { data, error } = await supabase
    .from("client_assignments")
    .select(select)
    .eq("user_id", userId)
    .returns<Array<Record<string, unknown>>>();
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

/** Tutti gli assegnamenti dell'utente (row complete). */
export async function findAllClientAssignmentsForUser(userId: string): Promise<ClientAssignmentRow[]> {
  const { data, error } = await supabase.from("client_assignments").select("*").eq("user_id", userId);
  if (error) throw error;
  return data ?? [];
}

/** Assegnamenti di un agente specifico. */
export async function findClientAssignmentsByAgent(agentId: string, userId: string): Promise<ClientAssignmentRow[]> {
  const { data, error } = await supabase
    .from("client_assignments")
    .select("*")
    .eq("agent_id", agentId)
    .eq("user_id", userId);
  if (error) throw error;
  return data ?? [];
}

/** Crea assegnamento e ritorna la riga creata. */
export async function insertClientAssignmentReturning(row: ClientAssignmentInsert): Promise<ClientAssignmentRow> {
  const { data, error } = await supabase.from("client_assignments").insert(row).select().single();
  if (error) throw error;
  return data;
}
