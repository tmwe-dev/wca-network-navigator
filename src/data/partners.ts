/**
 * Data Access Layer — Partners
 * Single source of truth for all partners table queries.
 */
import { supabase } from "@/integrations/supabase/client";
import { sanitizeSearchTerm } from "@/lib/sanitizeSearch";
import { queryKeys } from "@/lib/queryKeys";
import type { QueryClient } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";
import { isRecord } from "@/lib/jsonGuards";

type PartnerRow = Database["public"]["Tables"]["partners"]["Row"];
type PartnerInsert = Database["public"]["Tables"]["partners"]["Insert"];
type PartnerType = Database["public"]["Enums"]["partner_type"];

// ─── Types ──────────────────────────────────────────────
export interface Partner {
  id: string;
  wca_id: number | null;
  company_name: string;
  company_alias?: string | null;
  country_code: string;
  country_name: string;
  city: string;
  office_type: string | null;
  address: string | null;
  phone: string | null;
  fax: string | null;
  mobile: string | null;
  emergency_phone: string | null;
  email: string | null;
  website: string | null;
  member_since: string | null;
  membership_expires: string | null;
  profile_description: string | null;
  has_branches: boolean | null;
  branch_cities: unknown;
  partner_type: string | null;
  is_active: boolean | null;
  is_favorite: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  enriched_at?: string | null;
  enrichment_data?: Record<string, unknown> | null;
  logo_url?: string | null;
  rating?: number | null;
  lead_status?: string | null;
  ai_parsed_at?: string | null;
}

export interface PartnerFilters {
  search?: string;
  countries?: string[];
  cities?: string[];
  partnerTypes?: string[];
  services?: string[];
  certifications?: string[];
  networks?: string[];
  minRating?: number;
  minYearsMember?: number;
  hasBranches?: boolean;
  expiresWithinMonths?: number | "active";
  favorites?: boolean;
  metPersonally?: boolean;
}

export interface PartnerWithRelations extends Partner {
  partner_services?: { service_category: string }[];
  partner_certifications?: { certification: string }[];
  partner_networks?: { id: string; network_name: string; expires: string | null }[];
  partner_contacts?: {
    id: string;
    name: string;
    title: string | null;
    email: string | null;
    direct_phone: string | null;
    mobile: string | null;
    is_primary: boolean | null;
    contact_alias: string | null;
  }[];
}

// ─── Constants ──────────────────────────────────────────
const PAGE_SIZE = 1000;

const PARTNER_LIST_SELECT = `
  *,
  partner_services (service_category),
  partner_certifications (certification),
  partner_networks (id, network_name, expires),
  partner_contacts (id, name, title, email, direct_phone, mobile, is_primary, contact_alias)
`;

const PARTNER_DETAIL_SELECT = `
  *,
  partner_contacts (*),
  partner_services (service_category),
  partner_certifications (certification),
  partner_networks (*),
  interactions (*),
  reminders (*)
`;

// ─── Helpers ────────────────────────────────────────────

interface SupabaseQueryResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

/** Fetch all rows by iterating with .range() in blocks of 1000 */
async function fetchAllRows<T>(buildQuery: (from: number, to: number) => PromiseLike<SupabaseQueryResult<T>>): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await buildQuery(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return all;
}

// ─── Queries ────────────────────────────────────────────

export async function findPartners(filters?: PartnerFilters): Promise<PartnerWithRelations[]> {
  return fetchAllRows((from, to) => {
    let query = supabase
      .from("partners")
      .select(PARTNER_LIST_SELECT);

    if (filters?.search) {
      const s = sanitizeSearchTerm(filters.search);
      if (s) query = query.or(`company_name.ilike.%${s}%,company_alias.ilike.%${s}%,email.ilike.%${s}%`);
    }
    if (filters?.countries?.length) query = query.in("country_code", filters.countries);
    if (filters?.cities?.length) query = query.in("city", filters.cities);
    if (filters?.partnerTypes?.length) {
      query = query.in("partner_type", filters.partnerTypes as PartnerType[]);
    }
    if (filters?.favorites) query = query.eq("is_favorite", true);

    return query.order("company_name").range(from, to).returns<PartnerWithRelations[]>();
  });
}

export async function findPartnersByCountry(countryCode: string): Promise<PartnerWithRelations[]> {
  return fetchAllRows((from, to) =>
    supabase
      .from("partners")
      .select(`*, partner_services (service_category), partner_certifications (certification)`)
      .eq("country_code", countryCode)
      .order("company_name")
      .range(from, to)
      .returns<PartnerWithRelations[]>()
  );
}

/**
 * Preview lightweight: primi N partner ordinati per nome, senza paginazione totale.
 * Usato come "default" quando non sono selezionati paesi (evita di scaricare 12k righe).
 */
export async function findPartnersPreview(limit = 50): Promise<PartnerWithRelations[]> {
  const { data, error } = await supabase
    .from("partners")
    .select(PARTNER_LIST_SELECT)
    .order("company_name", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as PartnerWithRelations[];
}

export async function getPartner(id: string) {
  const { data, error } = await supabase
    .from("partners")
    .select(PARTNER_DETAIL_SELECT)
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function updatePartner(id: string, updates: Partial<PartnerRow>) {
  // Separate lead_status updates to route through RPC guard
  const { lead_status, ...otherUpdates } = updates;

  if (lead_status) {
    // P3.7: apply_lead_status_rpc non esiste a DB. Fallback a UPDATE diretto.
    const { error: rpcError } = await supabase
      .from("partners")
      .update({ lead_status })
      .eq("id", id);
    if (rpcError) throw rpcError;
  }

  // Apply remaining non-status updates
  if (Object.keys(otherUpdates).length > 0) {
    const { error } = await supabase
      .from("partners")
      .update(otherUpdates)
      .eq("id", id);
    if (error) throw error;
  }
}

export async function toggleFavorite(id: string, isFavorite: boolean) {
  const { error } = await supabase
    .from("partners")
    .update({ is_favorite: isFavorite })
    .eq("id", id);
  if (error) throw error;
}

// ─── Sherlock findings persistence ──────────────────────
/**
 * Salva sul partner i `consolidated` findings prodotti da una run Sherlock.
 *
 * Strategia non-distruttiva:
 *  - i campi top-level (`website`, `phone`, `email`, `address`) vengono
 *    scritti SOLO se il partner non li ha già (no overwrite)
 *  - tutti gli altri findings finiscono in `enrichment_data` come merge
 *    additivo, con `_sherlock_last_run` come marker temporale
 *  - `linkedin_company_url_discovered` → `enrichment_data.linkedin_url`
 *
 * Restituisce il numero di campi nuovi/aggiornati (per toast diff).
 */
export async function persistSherlockFindings(
  partnerId: string,
  consolidated: Record<string, unknown>,
): Promise<{ updatedFields: number; touchedKeys: string[] }> {
  if (!partnerId || !consolidated || Object.keys(consolidated).length === 0) {
    return { updatedFields: 0, touchedKeys: [] };
  }

  // Carica il record corrente per merge additivo + check campi vuoti
  const { data: current, error: loadErr } = await supabase
    .from("partners")
    .select("website, phone, email, address, enrichment_data")
    .eq("id", partnerId)
    .maybeSingle();
  if (loadErr || !current) return { updatedFields: 0, touchedKeys: [] };

  const updates: Record<string, unknown> = {};
  const touched: string[] = [];

  // Helper: estrai una stringa "presentabile" da string | string[] | object
  const asString = (v: unknown): string | null => {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (Array.isArray(v) && v.length > 0 && typeof v[0] === "string") return String(v[0]).trim() || null;
    return null;
  };

  // Mappa diretta sui campi colonna SOLO se vuoti
  const websiteDiscovered = asString(consolidated.website_discovered) ?? asString(consolidated.website);
  if (websiteDiscovered && !current.website) {
    updates.website = websiteDiscovered;
    touched.push("website");
  }
  const phoneDiscovered = asString(consolidated.phone) ?? asString(consolidated.phones);
  if (phoneDiscovered && !current.phone) {
    updates.phone = phoneDiscovered;
    touched.push("phone");
  }
  const emailDiscovered = asString(consolidated.email) ?? asString(consolidated.emails);
  if (emailDiscovered && !current.email) {
    updates.email = emailDiscovered;
    touched.push("email");
  }
  const addressDiscovered = asString(consolidated.address);
  if (addressDiscovered && !current.address) {
    updates.address = addressDiscovered;
    touched.push("address");
  }

  // Merge additivo in enrichment_data
  const prevEnrichment = (current.enrichment_data as Record<string, unknown> | null) ?? {};
  const linkedinUrl =
    asString(consolidated.linkedin_company_url_discovered) ??
    asString((consolidated.linkedin_company as Record<string, unknown> | undefined)?.url) ??
    asString(consolidated.linkedin_company);

  const sherlockBucket: Record<string, unknown> = {
    ...((prevEnrichment.sherlock as Record<string, unknown> | undefined) ?? {}),
  };
  // Conserva tutti i findings non già mappati su colonne
  for (const [k, v] of Object.entries(consolidated)) {
    if (v == null || v === undefined || v === "") continue;
    if (k.startsWith("_")) continue;
    sherlockBucket[k] = v;
    if (!touched.includes(k)) touched.push(k);
  }
  sherlockBucket._last_run_at = new Date().toISOString();

  const newEnrichment: Record<string, unknown> = {
    ...prevEnrichment,
    sherlock: sherlockBucket,
  };
  if (linkedinUrl && !prevEnrichment.linkedin_url) {
    newEnrichment.linkedin_url = linkedinUrl;
  }
  updates.enrichment_data = newEnrichment;
  updates.enriched_at = new Date().toISOString();

  const { error } = await supabase
    .from("partners")
    .update(updates as Database["public"]["Tables"]["partners"]["Update"])
    .eq("id", partnerId);
  if (error) return { updatedFields: 0, touchedKeys: [] };

  return { updatedFields: touched.length, touchedKeys: touched };
}

export async function getPartnerStats() {
  const partners = await fetchAllRows<{ id: string; country_code: string; country_name: string; partner_type: string | null; member_since: string | null }>(
    (from, to) =>
      supabase
        .from("partners")
        .select("id, country_code, country_name, partner_type, member_since")
        .range(from, to)
        .returns<{ id: string; country_code: string; country_name: string; partner_type: string | null; member_since: string | null }[]>()
  );

  const totalPartners = partners.length;
  const countryCounts: Record<string, { name: string; count: number }> = {};
  const typeCounts: Record<string, number> = {};

  partners.forEach((p) => {
    if (!countryCounts[p.country_code]) {
      countryCounts[p.country_code] = { name: p.country_name, count: 0 };
    }
    countryCounts[p.country_code].count++;
    if (p.partner_type) {
      typeCounts[p.partner_type] = (typeCounts[p.partner_type] || 0) + 1;
    }
  });

  return {
    totalPartners,
    uniqueCountries: Object.keys(countryCounts).length,
    countryCounts,
    typeCounts,
  };
}

/** Count active partners (head-only, no data transfer) */
export async function countActivePartners() {
  const { count, error } = await supabase
    .from("partners")
    .select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

/** Get distinct country codes from active partners */
export async function getDistinctCountries() {
  const { data, error } = await supabase
    .from("partners")
    .select("country_code");
  if (error) throw error;
  const unique = new Set((data ?? []).map(r => r.country_code));
  return [...unique];
}

export async function getCountryCodesBatched(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  let from = 0;
  const batchSize = 1000;
  while (true) {
    const { data } = await supabase
      .from("partners")
      .select("country_code")
      .not("country_code", "is", null)
      .range(from, from + batchSize - 1);
    if (!data || data.length === 0) break;
    data.forEach(r => { const cc = r.country_code!; counts[cc] = (counts[cc] || 0) + 1; });
    if (data.length < batchSize) break;
    from += batchSize;
  }
  return counts;
}

/** Search partners by name (for command palette, autocomplete) */
export async function searchPartners(term: string, limit = 10) {
  const s = sanitizeSearchTerm(term);
  if (!s) return [];
  const { data, error } = await supabase
    .from("partners")
    .select("id, company_name, country_code, city, logo_url")
    .ilike("company_name", `%${s}%`)
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/** Find partner by WCA ID */
export async function findPartnerByWcaId(wcaId: number) {
  const { data, error } = await supabase
    .from("partners")
    .select("*")
    .eq("wca_id", wcaId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Find partner by company name (fuzzy) */
export async function findPartnerByName(name: string) {
  const { data, error } = await supabase
    .from("partners")
    .select("id, company_name, country_code, enrichment_data")
    .ilike("company_name", `%${name}%`)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Count partners with null country_code */
export async function countPartnersWithoutCountry() {
  const { count, error } = await supabase
    .from("partners")
    .select("*", { count: "exact", head: true })
    .is("country_code", null);
  if (error) throw error;
  return count ?? 0;
}

/** Get partners by IDs (batched) */
export async function getPartnersByIds(ids: string[], select = "id, company_name, email, website") {
  const results: Array<Record<string, unknown>> = [];
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    const { data, error } = await supabase
      .from("partners")
      .select(select)
      .in("id", batch);
    if (error) throw error;
    if (data) results.push(...(data as unknown as Array<Record<string, unknown>>));
  }
  return results;
}

/** Get WCA IDs for partners in given countries */
export async function getWcaIdsByCountries(countryCodes: string[]) {
  const { data, error } = await supabase
    .from("partners")
    .select("id, wca_id")
    .in("country_code", countryCodes)
    .not("wca_id", "is", null);
  if (error) throw error;
  return data ?? [];
}

/** Delete partners by IDs (batched) */
export async function deletePartnersByIds(ids: string[]) {
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    const { error } = await supabase.from("partners").delete().in("id", batch);
    if (error) throw error;
  }
}

/** Insert a new partner and return it */
export async function createPartner(partner: PartnerInsert) {
  const { data, error } = await supabase
    .from("partners")
    .insert(partner)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Get partners by IDs with custom select and filters */
export async function getPartnersByIdsFiltered(ids: string[], select: string, filters?: Record<string, unknown>) {
  const results: Array<Record<string, unknown>> = [];
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    let q = supabase.from("partners").select(select).in("id", batch);
    if (filters) {
      for (const [key, val] of Object.entries(filters)) {
        if (Array.isArray(val)) q = q.in(key, val);
        else q = q.eq(key, val as string);
      }
    }
    const { data, error } = await q;
    if (error) throw error;
    if (data) results.push(...(data as unknown as Array<Record<string, unknown>>));
  }
  return results;
}

/** Search partners by name/alias with custom select and ordering */
export async function searchPartnersByNameAlias(term: string, select: string, limit = 20) {
  const s = sanitizeSearchTerm(term);
  if (!s) return [];
  const { data, error } = await supabase
    .from("partners")
    .select(select)
    .or(`company_name.ilike.%${s}%,company_alias.ilike.%${s}%`)
    .order("country_name").order("city").order("company_name")
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getPartnersByCountries(countryCodes: string[], select: string, options?: { noProfile?: boolean }): Promise<Array<Record<string, unknown>>> {
  let q = supabase.from("partners").select(select).in("country_code", countryCodes).not("wca_id", "is", null);
  if (options?.noProfile) q = q.is("raw_profile_html", null);
  const { data, error } = await q.order("company_name");
  if (error) throw error;
  return (data ?? []) as unknown as Array<Record<string, unknown>>;
}

/** Delete partners and all related data by IDs */
export async function deletePartnersWithRelations(ids: string[]) {
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    await supabase.from("partner_contacts").delete().in("partner_id", batch);
    await supabase.from("partner_networks").delete().in("partner_id", batch);
    await supabase.from("partner_services").delete().in("partner_id", batch);
    await supabase.from("partner_certifications").delete().in("partner_id", batch);
    await supabase.from("partner_social_links").delete().in("partner_id", batch);
    await supabase.from("interactions").delete().in("partner_id", batch);
    await supabase.from("reminders").delete().in("partner_id", batch);
    await supabase.from("activities").delete().in("partner_id", batch);
    await supabase.from("partners").delete().in("id", batch);
  }
}

export interface PartnerLeadResult { id: string; company_name?: string; email?: string | null; lead_status?: string; [k: string]: unknown }

export async function getPartnersByLeadStatus(statuses: string[], select = "id"): Promise<PartnerLeadResult[]> {
  const { data, error } = await supabase
    .from("partners")
    .select(select)
    .in("lead_status", statuses);
  if (error) throw error;
  return (data ?? []) as unknown as PartnerLeadResult[];
}

/**
 * Get partners by lead status using v_pipeline_lead materialized view.
 * Provides enriched pipeline data (touch counts, last activity, pending reminders, etc.)
 * faster than individual queries. Use this for pipeline views, funnel analysis, and
 * lead status filtering.
 */
export interface PipelineLeadRow {
  partner_id: string;
  user_id: string;
  company_name: string;
  company_alias: string | null;
  country_code: string;
  country_name: string;
  city: string;
  email: string | null;
  phone: string | null;
  lead_status: string;
  is_active: boolean | null;
  is_favorite: boolean | null;
  rating: number | null;
  interaction_count: number;
  last_interaction_at: string | null;
  partner_created_at: string | null;
  enriched_at: string | null;
  converted_at: string | null;
  touch_count: number;
  last_outbound_at: string | null;
  days_since_last_outbound: number;
  last_inbound_at: string | null;
  last_inbound_category: string | null;
  days_since_last_inbound: number | null;
  pending_reminders: number;
  has_deep_search: boolean;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
}

export async function getPartnersByLeadStatusFromView(
  statuses: string[],
  select = "partner_id, company_name, email, lead_status, touch_count, last_outbound_at, days_since_last_outbound"
): Promise<PipelineLeadRow[]> {
  // P3.7: v_pipeline_lead view non esiste a DB. Query diretta a `partners`
  // mappata sulla shape PipelineLeadRow. I campi calcolati (touch_count,
  // last_outbound_at, ...) sono restituiti a default — i consumer ricomputano se serve.
  void select;
  const { data, error } = await supabase
    .from("partners")
    .select(
      "id, company_name, company_alias, country_code, city, email, phone, lead_status, is_active, is_favorite, rating, created_at, enriched_at, converted_at"
    )
    .in("lead_status", statuses)
    .is("deleted_at", null);
  if (error) throw error;
  type PartnerBase = {
    id: string;
    company_name: string | null;
    company_alias: string | null;
    country_code: string | null;
    city: string | null;
    email: string | null;
    phone: string | null;
    lead_status: string | null;
    is_active: boolean | null;
    is_favorite: boolean | null;
    rating: number | null;
    created_at: string | null;
    enriched_at: string | null;
    converted_at: string | null;
  };
  return ((data ?? []) as PartnerBase[]).map((p): PipelineLeadRow => ({
    partner_id: p.id,
    user_id: "",
    company_name: p.company_name ?? "",
    company_alias: p.company_alias,
    country_code: p.country_code ?? "",
    country_name: "",
    city: p.city ?? "",
    email: p.email,
    phone: p.phone,
    lead_status: p.lead_status ?? "",
    is_active: p.is_active,
    is_favorite: p.is_favorite,
    rating: p.rating,
    interaction_count: 0,
    last_interaction_at: null,
    partner_created_at: p.created_at,
    enriched_at: p.enriched_at,
    converted_at: p.converted_at,
    touch_count: 0,
    last_outbound_at: null,
    days_since_last_outbound: 0,
    last_inbound_at: null,
    last_inbound_category: null,
    days_since_last_inbound: null,
    pending_reminders: 0,
    has_deep_search: false,
    primary_contact_name: null,
    primary_contact_email: null,
  }));
}

export async function findPartnerByEmail(email: string) {
  const { data, error } = await supabase
    .from("partners")
    .select("id, company_name, company_alias, country_code, city, email")
    .ilike("email", email)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function findPartnersForEnrichment(filters: { country?: string; type?: string; onlyNotEnriched?: boolean }, limit = 500) {
  let q = supabase.from("partners").select("id, company_name, city, country_code, website, enriched_at, partner_type, rating").not("website", "is", null).order("company_name");
  if (filters.country) q = q.eq("country_code", filters.country);
  if (filters.type) q = q.eq("partner_type", filters.type as PartnerType);
  if (filters.onlyNotEnriched) q = q.is("enriched_at", null);
  const { data, error } = await q.limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getPartnerWebsite(id: string) {
  const { data, error } = await supabase.from("partners").select("id, website").eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function updateLeadStatus(table: "partners" | "imported_contacts", id: string, status: string) {
  // P3.7: apply_lead_status_rpc non esiste a DB. UPDATE diretto sulla tabella.
  const { error } = table === "partners"
    ? await supabase.from("partners").update({ lead_status: status }).eq("id", id)
    : await supabase.from("imported_contacts").update({ lead_status: status }).eq("id", id);
  if (error) throw error;
}

// ─── Cache Invalidation ────────────────────────────────
export function invalidatePartnerCache(qc: QueryClient, partnerId?: string) {
  qc.invalidateQueries({ queryKey: queryKeys.partners.all });
  qc.invalidateQueries({ queryKey: queryKeys.partnerStats });
  if (partnerId) {
    qc.invalidateQueries({ queryKey: queryKeys.partner(partnerId) });
  }
}

/**
 * Persiste su `partners.enrichment_data` un URL LinkedIn scoperto in fase di
 * Cockpit lookup. Silent-on-error: nessuna eccezione, nessun toast; il chiamante
 * riceve solo un boolean di esito (true = riga trovata e aggiornata).
 *
 * Sostituisce il blocco inline `useCockpitLogic.ts` (P001-007) mantenendo
 * comportamento identico:
 *   - match azienda via `ilike("company_name", "%<name>%")` limit 1
 *   - merge additivo su `enrichment_data`
 *   - scrittura chiavi `linkedin_profile_url`, `linkedin_lookup_at`,
 *     `linkedin_resolved_method`
 */
export async function persistLinkedInProfileForCompany(
  companyName: string,
  linkedinUrl: string,
  method: string,
): Promise<boolean> {
  return await __persistLinkedInProfileForCompany(companyName, linkedinUrl, method);
}

/** Lookup fuzzy per nome azienda: id + enrichment_data della prima corrispondenza. */
export async function findPartnerEnrichmentByCompanyName(
  companyName: string,
): Promise<{ id: string; enrichment_data: unknown } | null> {
  const { data } = await supabase
    .from("partners")
    .select("id, enrichment_data")
    .ilike("company_name", `%${companyName}%`)
    .limit(1);
  return data?.[0] ?? null;
}

async function __persistLinkedInProfileForCompany(
  companyName: string,
  linkedinUrl: string,
  method: string,
): Promise<boolean> {
  if (!companyName || !linkedinUrl) return false;
  try {
    const { data: partnerRows } = await supabase
      .from("partners")
      .select("id, enrichment_data")
      .ilike("company_name", `%${companyName}%`)
      .limit(1);
    const row = partnerRows?.[0];
    if (!row) return false;
    const existing = (row.enrichment_data as Record<string, unknown> | null) ?? {};
    const { error } = await supabase
      .from("partners")
      .update({
        enrichment_data: {
          ...existing,
          linkedin_profile_url: linkedinUrl,
          linkedin_lookup_at: new Date().toISOString(),
          linkedin_resolved_method: method,
        },
      })
      .eq("id", row.id);
    return !error;
  } catch {
    return false;
  }
}

/** wca_id non nulli dei partner di un paese (scan directory). */
export async function findPartnerWcaIdsByCountry(countryCode: string) {
  const { data } = await supabase
    .from("partners")
    .select("wca_id")
    .eq("country_code", countryCode)
    .not("wca_id", "is", null);
  return data;
}

/** Coppie id/wca_id per un elenco di wca_id (scan directory). */
export async function findPartnerIdsByWcaIds(wcaIds: number[]) {
  const { data } = await supabase
    .from("partners")
    .select("id, wca_id")
    .in("wca_id", wcaIds);
  return data;
}

/** Insert partner senza throw: ritorna il partner creato o l'errore testuale. */
export async function createPartnerSafe(
  partner: PartnerInsert,
): Promise<{ partner: PartnerRow | null; error: string | null }> {
  const { data, error } = await supabase.from("partners").insert(partner).select().single();
  if (error) return { partner: null, error: error.message };
  return { partner: data as PartnerRow, error: null };
}

/** Elenco minimale per matching blacklist (nome + paese). */
export async function findPartnersForBlacklistMatch(): Promise<Array<{ id: string; company_name: string; country_name: string | null }>> {
  const { data } = await supabase.from("partners").select("id, company_name, country_name");
  return (data ?? []) as Array<{ id: string; company_name: string; country_name: string | null }>;
}

export async function getPartnerEnrichmentData(id: string): Promise<Record<string, unknown>> {
  const { data } = await supabase.from("partners").select("enrichment_data").eq("id", id).single();
  return (data?.enrichment_data as Record<string, unknown>) || {};
}

/** Statistiche paginate partner attivi (country/email) per mission builder. */
export async function findActivePartnersCountryEmailStats(): Promise<{ country_code: string | null; country_name: string | null; email: string | null }[]> {
  const all: { country_code: string | null; country_name: string | null; email: string | null }[] = [];
  const BATCH = 2000;
  let from = 0;
  while (true) {
    const { data: batch } = await supabase.from("partners").select("country_code, country_name, email").eq("is_active", true).range(from, from + BATCH - 1);
    if (!batch || batch.length === 0) break;
    all.push(...batch);
    if (batch.length < BATCH) break;
    from += BATCH;
  }
  return all;
}

/** Id partner attivi filtrati per country_code, limitati. */
export async function findActivePartnerIdsByCountries(countryCodes: string[], limit: number): Promise<{ id: string }[]> {
  const { data } = await supabase.from("partners").select("id").in("country_code", countryCodes).eq("is_active", true).limit(limit);
  return data ?? [];
}

// ── Enrichment / Globe bulk loaders (LOVABLE-DAL) ──

export interface EnrichmentPartnerRow {
  id: string;
  company_name: string;
  email: string | null;
  website: string | null;
  country_code: string | null;
  logo_url: string | null;
  enrichment_data: Record<string, unknown> | null;
}

/** Carica TUTTI i partner per la vista di enrichment (bypass cap 1000 righe). */
export async function loadAllPartnersForEnrichment(): Promise<EnrichmentPartnerRow[]> {
  const all: EnrichmentPartnerRow[] = [];
  const batchSize = 1000;
  let page = 0;
  while (page < 200) {
    const from = page * batchSize;
    const to = from + batchSize - 1;
    const { data, error } = await supabase
      .from("partners")
      .select("id, company_name, email, website, country_code, logo_url, enrichment_data")
      .range(from, to)
      .limit(batchSize);
    if (error) throw error;
    if (data && data.length) all.push(...(data as EnrichmentPartnerRow[]));
    if (!data || data.length < batchSize) break;
    page++;
  }
  return all;
}

export interface GlobePartnerRow {
  id: string;
  company_name: string;
  city: string;
  country_code: string;
  country_name: string;
  email: string | null;
  partner_type: string | null;
}

/** Carica TUTTI i partner attivi per il globo 3D (pagina fino a esaurimento). */
export async function fetchAllPartnersForGlobe(): Promise<GlobePartnerRow[]> {
  const PAGE_SIZE = 2000;
  let all: GlobePartnerRow[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("partners")
      .select("id, company_name, city, country_code, country_name, email, partner_type")
      .eq("is_active", true)
      .order("company_name")
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data as GlobePartnerRow[]);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return all;
}

/** Carica TUTTI i partner attivi di un paese per il globo 3D. */
export async function fetchPartnersByCountryForGlobe(countryCode: string): Promise<GlobePartnerRow[]> {
  const PAGE_SIZE = 2000;
  let all: GlobePartnerRow[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("partners")
      .select("id, company_name, city, country_code, country_name, email, partner_type")
      .eq("is_active", true)
      .eq("country_code", countryCode)
      .order("company_name")
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data as GlobePartnerRow[]);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return all;
}

export interface PickerPartnerRow {
  id: string;
  company_name: string;
  company_alias: string | null;
  country_code: string | null;
  city: string;
  lead_status: string | null;
}

/** Ricerca partner attivi per il picker contatti email (search + country). */
export async function searchPartnersForPicker(search: string, countryCode: string | null): Promise<PickerPartnerRow[]> {
  let q = supabase
    .from("partners")
    .select("id, company_name, company_alias, country_code, city, lead_status");
  if (search.length >= 3) q = q.ilike("company_name", `%${search}%`);
  if (countryCode) q = q.eq("country_code", countryCode);
  q = q.eq("is_active", true);
  const { data } = await q.order("company_name").limit(200);
  return (data ?? []) as PickerPartnerRow[];
}

/** Massimo wca_id presente in DB (per suggerire il range di sync). */
export async function findMaxWcaId(): Promise<number> {
  const { data } = await supabase
    .from("partners")
    .select("wca_id")
    .not("wca_id", "is", null)
    .order("wca_id", { ascending: false })
    .limit(1)
    .single();
  return data?.wca_id || 0;
}

export interface CsvPartnerInsertRow {
  company_name: string;
  country_code: string;
  country_name: string;
  city: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  partner_type: string;
  wca_id?: number | null;
  is_active: boolean;
}

/** Insert batch di partner da import CSV. Ritorna le righe inserite. */
export async function insertPartnersBatch(rows: CsvPartnerInsertRow[]) {
  const { data, error } = await supabase
    .from("partners")
    .insert(rows.map((r) => ({ ...r, partner_type: r.partner_type as PartnerType })))
    .select();
  if (error) throw error;
  return data ?? [];
}

/** Lead status + country di un partner, usato da usePreContext (Email Forge). */
export async function findPartnerRelationshipSnapshot(partnerId: string) {
  const { data } = await supabase
    .from("partners")
    .select("lead_status, country")
    .eq("id", partnerId)
    .maybeSingle();
  return data;
}

/** Snapshot enrichment testuale per il tab Deep Search di Email Forge. */
export async function findPartnerDeepSearchSnapshot(id: string) {
  const { data } = await supabase
    .from("partners")
    .select("id, enrichment_data, profile_description, raw_profile_html, raw_profile_markdown, ai_parsed_at")
    .eq("id", id)
    .maybeSingle();
  return data;
}

/** Snapshot compatto per l'hero card del destinatario in Compose. */
export interface PartnerHeroSnapshot {
  company_name: string | null;
  company_alias: string | null;
  country_name: string | null;
  country_code: string | null;
  city: string | null;
  logo_url: string | null;
  last_interaction_at: string | null;
  interaction_count: number | null;
  enrichment_data: { deep_search_at?: string } | null;
  lead_status: string | null;
}

export async function findPartnerHeroSnapshot(id: string): Promise<PartnerHeroSnapshot | null> {
  const { data } = await supabase
    .from("partners")
    .select("company_name, company_alias, country_name, country_code, city, logo_url, last_interaction_at, interaction_count, enrichment_data, lead_status")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const enrichment: Record<string, unknown> | null = isRecord(data.enrichment_data) ? data.enrichment_data : null;
  const rawDeepSearch = enrichment ? enrichment["deep_search_at"] : undefined;
  const deepSearchAt = typeof rawDeepSearch === "string" ? rawDeepSearch : undefined;
  return {
    company_name: data.company_name ?? null,
    company_alias: data.company_alias ?? null,
    country_name: data.country_name ?? null,
    country_code: data.country_code ?? null,
    city: data.city ?? null,
    logo_url: data.logo_url ?? null,
    last_interaction_at: data.last_interaction_at ?? null,
    interaction_count: data.interaction_count ?? null,
    enrichment_data: enrichment ? (deepSearchAt ? { deep_search_at: deepSearchAt } : {}) : null,
    lead_status: data.lead_status ?? null,
  };
}

export interface PartnersPaginatedFilters extends PartnerFilters {
  quality?: string;
  hideHolding?: boolean;
  sort?: string;
}

export interface PartnerPaginatedRow extends Record<string, unknown> {
  id: string;
  company_name?: string;
  company_alias?: string | null;
  country_code?: string;
  city?: string;
  lead_status?: string;
}

export interface PartnersPaginatedResult {
  partners: PartnerPaginatedRow[];
  total: number;
}

/**
 * Query paginata leggera (no join) per il Network. Estratta da `usePartnersPaginated`.
 */
export async function findPartnersPaginated(
  filters: PartnersPaginatedFilters | undefined,
  from: number,
  to: number,
): Promise<PartnersPaginatedResult> {
  const selectFields = `id, company_name, company_alias, country_code, city, email, phone, mobile,
       office_type, is_active, is_favorite, rating, member_since, wca_id,
       raw_profile_html, enrichment_data, partner_type, lead_status`;

  let query = supabase
    .from("partners")
    .select(selectFields, { count: "exact" })
    .eq("is_active", true);

  if (filters?.search) {
    const s = sanitizeSearchTerm(filters.search);
    if (s) query = query.ilike("company_name", `%${s}%`);
  }

  if (filters?.countries && filters.countries.length > 0) {
    query = query.in("country_code", filters.countries);
  }

  if (filters?.cities && filters.cities.length > 0) {
    query = query.in("city", filters.cities);
  }

  if (filters?.partnerTypes && filters.partnerTypes.length > 0) {
    query = query.in("partner_type", filters.partnerTypes as readonly ("3pl" | "carrier" | "courier" | "customs_broker" | "freight_forwarder" | "nvocc")[]);
  }

  if (filters?.favorites) {
    query = query.eq("is_favorite", true);
  }

  if (filters?.hideHolding) {
    query = query.or("lead_status.is.null,lead_status.eq.new");
  }

  if (filters?.quality === "with_email") {
    query = query.not("email", "is", null);
  }
  if (filters?.quality === "with_phone") {
    query = query.or("phone.not.is.null,mobile.not.is.null");
  }
  if (filters?.quality === "with_profile") {
    query = query.not("raw_profile_html", "is", null);
  }
  if (filters?.quality === "no_email") {
    query = query.is("email", null);
  }

  if (filters?.sort === "rating") {
    query = query.order("rating", { ascending: false, nullsFirst: false }).order("company_name");
  } else if (filters?.sort === "recent") {
    query = query.order("member_since", { ascending: false, nullsFirst: false }).order("company_name");
  } else {
    query = query.order("company_name");
  }

  const { data, error, count } = await query.range(from, to);
  if (error) throw error;

  return {
    partners: data || [],
    total: count ?? 0,
  };
}

/** Massimo `wca_id` presente in anagrafica partner (0 se assente). */
export async function getMaxPartnerWcaId(): Promise<number> {
  const { data } = await supabase
    .from("partners")
    .select("wca_id")
    .not("wca_id", "is", null)
    .order("wca_id", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.wca_id ?? 0;
}
