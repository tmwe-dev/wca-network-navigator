/**
 * DAL — dominio Report Aziende (`ra_*`).
 *
 * Le tabelle `ra_prospects` / `ra_contacts` / `ra_interactions` /
 * `ra_scraping_jobs` NON esistono in `public` (verificato su
 * information_schema). Non vengono quindi interrogate affatto: questo modulo
 * espone il contratto della feature tramite `unavailableRead` /
 * `unavailableWrite`, così le pagine RA restano navigabili con stato vuoto e
 * le scritture falliscono in modo chiuso e diagnosticabile.
 *
 * Quando le tabelle verranno create, sostituire le chiamate `unavailable*`
 * con `supabase.from(...)` tipizzato e rimuoverle da `ABSENT_RELATIONS`.
 */
import { unavailableRead, unavailableWrite } from "@/data/_shared/unavailableSchema";
import type {
  RAContact,
  RAInteraction,
  RALeadStatus,
  RAProspect,
  RAProspectFilters,
  RAScrapingJob,
} from "@/types/ra";

export interface RAProspectPage {
  readonly items: RAProspect[];
  readonly totalCount: number;
  readonly page: number;
  readonly pageSize: number;
}

const DEFAULT_PAGE_SIZE = 100;

export async function findRAProspects(filters: RAProspectFilters = {}): Promise<RAProspectPage> {
  return unavailableRead<RAProspectPage>("ra_prospects", {
    items: [],
    totalCount: 0,
    page: filters.page ?? 0,
    pageSize: filters.pageSize ?? DEFAULT_PAGE_SIZE,
  });
}

export async function findRAProspectById(id: string): Promise<RAProspect | null> {
  void id;
  return unavailableRead<RAProspect | null>("ra_prospects", null);
}

export async function findRAContacts(prospectId: string): Promise<RAContact[]> {
  void prospectId;
  return unavailableRead<RAContact[]>("ra_contacts", []);
}

export async function findRAInteractions(prospectId: string): Promise<RAInteraction[]> {
  void prospectId;
  return unavailableRead<RAInteraction[]>("ra_interactions", []);
}

export type RAProspectUpsert = Partial<RAProspect> & { company_name: string };

export async function upsertRAProspect(prospect: RAProspectUpsert): Promise<RAProspect> {
  void prospect;
  return unavailableWrite("ra_prospects");
}

/**
 * BOUNDED CONTEXT: `ra_prospects` possiede la propria macchina a stati
 * (new→first_touch_sent→holding→engaged→qualified→negotiation→
 * converted/archived/blacklisted), separata da partners/imported_contacts.
 */
export async function updateRALeadStatus(id: string, status: RALeadStatus): Promise<void> {
  void id;
  void status;
  return unavailableWrite("ra_prospects");
}

export async function deleteRAProspects(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  return unavailableWrite("ra_prospects");
}

// --- Scraping jobs ----------------------------------------------------------

export async function findRAJobs(status?: RAScrapingJob["status"]): Promise<RAScrapingJob[]> {
  void status;
  return unavailableRead<RAScrapingJob[]>("ra_scraping_jobs", []);
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
  void job;
  return unavailableWrite("ra_scraping_jobs");
}

export async function updateRAJob(id: string, updates: Partial<RAScrapingJob>): Promise<void> {
  void id;
  void updates;
  return unavailableWrite("ra_scraping_jobs");
}
