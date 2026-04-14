/**
 * Data Access Layer — Partners
 * Single source of truth for all partners table queries.
 */
import { supabase } from "@/integrations/supabase/client";
import { sanitizeSearchTerm } from "@/lib/sanitizeSearch";
import { queryKeys } from "@/lib/queryKeys";
import type { QueryClient } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";

type PartnerRow = Database["public"]["Tables"]["partners"]["Row"];
type PartnerInsert = Database["public"]["Tables"]["partners"]["Insert"];

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
async function fetchAllRows<T>(buildQuery: (from: number, to: number) => Promise<SupabaseQueryResult<T>>): Promise<T[]> {
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
      if (s) query = query.ilike("company_name", `%${s}%`);
    }
    if (filters?.countries?.length) query = query.in("country_code", filters.countries);
    if (filters?.cities?.length) query = query.in("city", filters.cities);
    if (filters?.partnerTypes?.length) query = query.in("partner_type", filters.partnerTypes as any); // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase enum filter type requires cast
    if (filters?.favorites) query = query.eq("is_favorite", true);

    return query.order("company_name").range(from, to) as unknown as Promise<SupabaseQueryResult<PartnerWithRelations>>;
  });
}

export async function findPartnersByCountry(countryCode: string): Promise<PartnerWithRelations[]> {
  return fetchAllRows((from, to) =>
    supabase
      .from("partners")
      .select(`*, partner_services (service_category), partner_certifications (certification)`)
      .eq("country_code", countryCode)
      .order("company_name")
      .range(from, to) as unknown as Promise<SupabaseQueryResult<PartnerWithRelations>>
  );
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
  const { error } = await supabase
    .from("partners")
    .update(updates)
    .eq("id", id);
  if (error) throw error;
}

export async function toggleFavorite(id: string, isFavorite: boolean) {
  const { error } = await supabase
    .from("partners")
    .update({ is_favorite: isFavorite })
    .eq("id", id);
  if (error) throw error;
}

export async function getPartnerStats() {
  const partners = await fetchAllRows<{ id: string; country_code: string; country_name: string; partner_type: string | null; member_since: string | null }>(
    (from, to) =>
      supabase
        .from("partners")
        .select("id, country_code, country_name, partner_type, member_since")
        .range(from, to) as unknown as Promise<SupabaseQueryResult<{ id: string; country_code: string; country_name: string; partner_type: string | null; member_since: string | null }>>
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic select string, caller must cast
export async function getPartnersByCountries(countryCodes: string[], select: string, options?: { noProfile?: boolean }): Promise<any[]> {
  let q = supabase.from("partners").select(select).in("country_code", countryCodes).not("wca_id", "is", null);
  if (options?.noProfile) q = q.is("raw_profile_html", null);
  const { data, error } = await q.order("company_name");
  if (error) throw error;
  return data ?? [];
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic select string, caller must cast
export async function getPartnersByLeadStatus(statuses: string[], select = "id"): Promise<any[]> {
  const { data, error } = await supabase
    .from("partners")
    .select(select)
    .in("lead_status", statuses);
  if (error) throw error;
  return data ?? [];
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
  if (filters.type) q = q.eq("partner_type", filters.type as any); // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase enum filter type requires cast
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
  const { error } = await supabase.from(table).update({ lead_status: status }).eq("id", id);
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
