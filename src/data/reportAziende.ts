/**
 * DAL — dominio Report Aziende (`ra_*`).
 *
 * CONFINE SANZIONATO: le tabelle `ra_prospects` / `ra_contacts` /
 * `ra_interactions` / `ra_scraping_jobs` NON esistono ancora nello schema
 * generato (verificato: 0 tabelle `ra%` in `public`). Finché non vengono
 * provisionate, l'accesso resta untyped ma è confinato a QUESTO file: hook e
 * UI non devono mai importare `untypedFrom`.
 *
 * Le letture degradano a vuoto invece di lanciare, così le pagine RA restano
 * navigabili anche a tabelle assenti. Le scritture propagano l'errore.
 */
import { untypedFrom } from "@/lib/supabaseUntyped";
import type {
  RAContact,
  RAInteraction,
  RALeadStatus,
  RAProspect,
  RAProspectFilters,
  RAScrapingJob,
} from "@/types/ra";

interface UntypedResult {
  readonly data: unknown;
  readonly error: unknown;
  readonly count?: unknown;
}

/** Le tabelle `ra_*` possono non esistere: in lettura si degrada a vuoto. */
function isMissingRelation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  const message = (error as { message?: unknown }).message;
  return code === "42P01" || (typeof message === "string" && /does not exist|schema cache/i.test(message));
}

function rowsOrEmpty<T>(result: UntypedResult): T[] {
  if (result.error) {
    if (isMissingRelation(result.error)) return [];
    throw result.error;
  }
  return (result.data ?? []) as T[];
}

export interface RAProspectPage {
  readonly items: RAProspect[];
  readonly totalCount: number;
  readonly page: number;
  readonly pageSize: number;
}

const DEFAULT_PAGE_SIZE = 100;

export async function findRAProspects(filters: RAProspectFilters = {}): Promise<RAProspectPage> {
  const page = filters.page ?? 0;
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;

  let q = untypedFrom("ra_prospects")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (filters.search) {
    const s = filters.search.replace(/%/g, "");
    q = q.or(
      `company_name.ilike.%${s}%,partita_iva.ilike.%${s}%,city.ilike.%${s}%,email.ilike.%${s}%`,
    );
  }
  if (filters.atecoCodes?.length) q = q.in("codice_ateco", filters.atecoCodes);
  if (filters.regions?.length) q = q.in("region", filters.regions);
  if (filters.provinces?.length) q = q.in("province", filters.provinces);
  if (filters.leadStatus) q = q.eq("lead_status", filters.leadStatus);
  if (filters.hasEmail) q = q.not("email", "is", null);
  if (filters.hasPec) q = q.not("pec", "is", null);
  if (filters.hasPhone) q = q.not("phone", "is", null);
  if (filters.minFatturato != null) q = q.gte("fatturato", filters.minFatturato);
  if (filters.maxFatturato != null) q = q.lte("fatturato", filters.maxFatturato);
  if (filters.minDipendenti != null) q = q.gte("dipendenti", filters.minDipendenti);
  if (filters.maxDipendenti != null) q = q.lte("dipendenti", filters.maxDipendenti);

  const from = page * pageSize;
  q = q.range(from, from + pageSize - 1);

  const result = (await q) as UntypedResult;
  const items = rowsOrEmpty<RAProspect>(result);
  const rawCount = result.error ? 0 : result.count;
  return {
    items,
    totalCount: typeof rawCount === "number" ? rawCount : items.length,
    page,
    pageSize,
  };
}

export async function findRAProspectById(id: string): Promise<RAProspect | null> {
  const result = (await untypedFrom("ra_prospects")
    .select("*")
    .eq("id", id)
    .maybeSingle()) as UntypedResult;
  if (result.error) {
    if (isMissingRelation(result.error)) return null;
    throw result.error;
  }
  return (result.data ?? null) as RAProspect | null;
}

export async function findRAContacts(prospectId: string): Promise<RAContact[]> {
  return rowsOrEmpty<RAContact>(
    (await untypedFrom("ra_contacts")
      .select("*")
      .eq("prospect_id", prospectId)
      .order("created_at", { ascending: false })) as UntypedResult,
  );
}

export async function findRAInteractions(prospectId: string): Promise<RAInteraction[]> {
  return rowsOrEmpty<RAInteraction>(
    (await untypedFrom("ra_interactions")
      .select("*")
      .eq("prospect_id", prospectId)
      .order("created_at", { ascending: false })) as UntypedResult,
  );
}

export type RAProspectUpsert = Partial<RAProspect> & { company_name: string };

export async function upsertRAProspect(prospect: RAProspectUpsert): Promise<RAProspect> {
  if (prospect.partita_iva) {
    const existing = (await untypedFrom("ra_prospects")
      .select("id")
      .eq("partita_iva", prospect.partita_iva)
      .maybeSingle()) as UntypedResult;
    const existingId = (existing.data as { id?: string } | null)?.id;
    if (existingId) {
      const updated = (await untypedFrom("ra_prospects")
        .update({ ...prospect, updated_at: new Date().toISOString() })
        .eq("id", existingId)
        .select()
        .single()) as UntypedResult;
      if (updated.error) throw updated.error;
      return updated.data as RAProspect;
    }
  }

  const inserted = (await untypedFrom("ra_prospects")
    .insert(prospect)
    .select()
    .single()) as UntypedResult;
  if (inserted.error) throw inserted.error;
  return inserted.data as RAProspect;
}

/**
 * BOUNDED CONTEXT: `ra_prospects` possiede la propria macchina a stati
 * (new→first_touch_sent→holding→engaged→qualified→negotiation→
 * converted/archived/blacklisted), separata da partners/imported_contacts.
 */
export async function updateRALeadStatus(id: string, status: RALeadStatus): Promise<void> {
  const result = (await untypedFrom("ra_prospects")
    .update({ lead_status: status, updated_at: new Date().toISOString() })
    .eq("id", id)) as UntypedResult;
  if (result.error) throw result.error;
}

export async function deleteRAProspects(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const result = (await untypedFrom("ra_prospects").delete().in("id", ids)) as UntypedResult;
  if (result.error) throw result.error;
}

// --- Scraping jobs ----------------------------------------------------------

export async function findRAJobs(status?: RAScrapingJob["status"]): Promise<RAScrapingJob[]> {
  let q = untypedFrom("ra_scraping_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (status) q = q.eq("status", status);
  return rowsOrEmpty<RAScrapingJob>((await q) as UntypedResult);
}

export type RAJobDraft = Pick<
  RAScrapingJob,
  | "job_type"
  | "ateco_codes"
  | "regions"
  | "provinces"
  | "min_fatturato"
  | "max_fatturato"
  | "delay_seconds"
  | "batch_size"
>;

export async function insertRAJob(job: RAJobDraft): Promise<RAScrapingJob> {
  const result = (await untypedFrom("ra_scraping_jobs")
    .insert({
      ...job,
      status: "pending",
      total_items: 0,
      processed_items: 0,
      saved_items: 0,
      error_count: 0,
    })
    .select()
    .single()) as UntypedResult;
  if (result.error) throw result.error;
  return result.data as RAScrapingJob;
}

export async function updateRAJob(id: string, updates: Partial<RAScrapingJob>): Promise<void> {
  const result = (await untypedFrom("ra_scraping_jobs")
    .update(updates)
    .eq("id", id)) as UntypedResult;
  if (result.error) throw result.error;
}
