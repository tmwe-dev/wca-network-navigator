/**
 * DAL — prospects
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Prospect = Database["public"]["Tables"]["prospects"]["Row"];


import { createLogger } from "@/lib/log";
const log = createLogger("prospects");

type ProspectUpdate = Database["public"]["Tables"]["prospects"]["Update"];

function buildProspectsBase() {
  return supabase.from("prospects").select("*").order("company_name");
}

export type ProspectsQueryBuilder = ReturnType<typeof buildProspectsBase>;

export async function queryProspects(builder: (q: ProspectsQueryBuilder) => ProspectsQueryBuilder) {
  const base = buildProspectsBase();
  const { data, error } = await builder(base);
  if (error) throw error;
  return data ?? [];
}

export async function updateProspectLeadStatus(id: string, status: string) {
  // P3.7: apply_lead_status_rpc non esiste a DB. UPDATE diretto.
  const { error } = await supabase
    .from("prospects")
    .update({ lead_status: status })
    .eq("id", id);
  if (error) throw error;
}

export async function updateProspect(id: string, updates: Record<string, unknown>) {
  // GUARD: strip lead_status — must go through updateProspectLeadStatus() / RPC
   
  const { lead_status: _stripped, ...safeUpdates } = updates;
  if (_stripped !== undefined) {
    log.warn("[updateProspect] lead_status stripped from generic update — use updateProspectLeadStatus() instead");
  }
  const { error } = await supabase.from("prospects").update(safeUpdates as ProspectUpdate).eq("id", id);
  if (error) throw error;
}

/**
 * Colonne di `prospects` scrivibili da flussi di arricchimento automatico
 * (scraping, AI). Whitelist esplicita: evita che un payload generato
 * dall'AI introduca colonne inesistenti (es. `profile_description`, che
 * appartiene a `partners`) facendo fallire l'intero update.
 */
const ENRICHABLE_PROSPECT_COLUMNS = [
  "email",
  "pec",
  "phone",
  "website",
  "address",
  "city",
  "province",
  "region",
  "cap",
  "codice_ateco",
  "descrizione_ateco",
  "forma_giuridica",
  "partita_iva",
  "codice_fiscale",
] as const;

export type ProspectEnrichmentResult = {
  readonly appliedFields: string[];
  readonly ignoredFields: string[];
};

/** Applica un payload di arricchimento filtrando sulle sole colonne reali. */
export async function applyProspectEnrichment(
  id: string,
  payload: Record<string, unknown>,
): Promise<ProspectEnrichmentResult> {
  const allowed = new Set<string>(ENRICHABLE_PROSPECT_COLUMNS);
  const updates: Record<string, unknown> = {};
  const ignoredFields: string[] = [];
  for (const [key, value] of Object.entries(payload)) {
    if (allowed.has(key)) updates[key] = value;
    else ignoredFields.push(key);
  }
  const appliedFields = Object.keys(updates);
  if (appliedFields.length > 0) {
    const { error } = await supabase
      .from("prospects")
      .update(updates as ProspectUpdate)
      .eq("id", id);
    if (error) throw error;
  }
  return { appliedFields, ignoredFields };
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

/** Chiavi di dedup (P.IVA + ragione sociale) per l'import prospect. */
export async function findProspectDedupKeys(): Promise<Array<{ partita_iva: string | null; company_name: string }>> {
  const { data } = await supabase
    .from("prospects")
    .select("partita_iva, company_name")
    .not("partita_iva", "is", null);
  return data ?? [];
}

export type ProspectContactRow = Database["public"]["Tables"]["prospect_contacts"]["Row"];

/** Contatti di un prospect. */
export async function findProspectContactsByProspectId(prospectId: string): Promise<ProspectContactRow[]> {
  const { data, error } = await supabase
    .from("prospect_contacts")
    .select("*")
    .eq("prospect_id", prospectId);
  if (error) throw error;
  return data ?? [];
}

export interface ProspectSearchRow {
  id: string;
  company_name: string;
  website: string | null;
  email: string | null;
  phone: string | null;
}

/** Prospect corrispondente al termine di ricerca sul nome azienda (tool scrape-prospect). */
export async function findProspectBySearchTerm(searchTerm: string): Promise<ProspectSearchRow | null> {
  const { data, error } = await supabase
    .from("prospects")
    .select("id, company_name, website, email, phone")
    .or(`company_name.ilike.%${searchTerm}%`)
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}
