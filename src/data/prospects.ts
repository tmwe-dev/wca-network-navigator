/**
 * DAL — prospects
 */
import { supabase } from "@/integrations/supabase/client";


import { createLogger } from "@/lib/log";
const log = createLogger("prospects");
export async function queryProspects(builder: (q: unknown) => unknown) {
  const base = supabase.from("prospects").select("*").order("company_name");
  const { data, error } = await (builder(base) as never);
  if (error) throw error;
  return data ?? [];
}

export async function updateProspectLeadStatus(id: string, status: string) {
  // P3.7: apply_lead_status_rpc non esiste a DB. UPDATE diretto.
  const { error } = await supabase
    .from("prospects")
    .update({ lead_status: status as never })
    .eq("id", id);
  if (error) throw error;
}

export async function updateProspect(id: string, updates: Record<string, unknown>) {
  // GUARD: strip lead_status — must go through updateProspectLeadStatus() / RPC
   
  const { lead_status: _stripped, ...safeUpdates } = updates;
  if (_stripped !== undefined) {
    log.warn("[updateProspect] lead_status stripped from generic update — use updateProspectLeadStatus() instead");
  }
  const { error } = await supabase.from("prospects").update(safeUpdates as never).eq("id", id);
  if (error) throw error;
}

/** Contatti management di un prospect. */
export async function findProspectContacts(prospectId: string): Promise<Array<Record<string, unknown>>> {
  const { data, error } = await supabase
    .from("prospect_contacts")
    .select("*")
    .eq("prospect_id", prospectId);
  if (error) throw error;
  return (data ?? []) as Array<Record<string, unknown>>;
}

export interface ProspectDedupRow {
  partita_iva: string | null;
  company_name: string;
}

/** Partita IVA + ragione sociale esistenti, per il dedup import scraping. */
export async function findProspectsForDedup(): Promise<ProspectDedupRow[]> {
  const { data } = await supabase
    .from("prospects")
    .select("partita_iva, company_name")
    .not("partita_iva", "is", null);
  return (data ?? []) as ProspectDedupRow[];
}

export interface ProspectInteractionRecordRow {
  id: string;
  interaction_type: string;
  title: string;
  description: string | null;
  outcome: string | null;
  created_by: string | null;
  created_at: string;
}

/** Interazioni prospect per il drawer contatto (Circuito di Attesa). */
export async function findProspectInteractionsForRecord(prospectId: string, limit = 20): Promise<ProspectInteractionRecordRow[]> {
  const { data } = await supabase
    .from("prospect_interactions")
    .select("*")
    .eq("prospect_id", prospectId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as unknown as ProspectInteractionRecordRow[];
}

/** Tutti i prospect ordinati per company_name. Estratto da `useProspects`. */
export async function findAllProspects(): Promise<Prospect[]> {
  const { data, error } = await supabase
    .from("prospects")
    .select("*")
    .order("company_name");
  if (error) throw error;
  return data ?? [];
}
