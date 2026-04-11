/**
 * Data Access Layer — Partners
 * Single source of truth for all partners table queries.
 */
import { supabase } from "@/integrations/supabase/client";
import { sanitizeSearchTerm } from "@/lib/sanitizeSearch";
import { queryKeys } from "@/lib/queryKeys";
import type { QueryClient } from "@tanstack/react-query";

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
/** Fetch all rows by iterating with .range() in blocks of 1000 */
async function fetchAllRows<T>(buildQuery: (from: number, to: number) => ReturnType<typeof supabase.from>): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await (buildQuery(offset, offset + PAGE_SIZE - 1) as any);
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
      .select(PARTNER_LIST_SELECT)
      .eq("is_active", true);

    if (filters?.search) {
      const s = sanitizeSearchTerm(filters.search);
      if (s) query = query.ilike("company_name", `%${s}%`);
    }
    if (filters?.countries?.length) query = query.in("country_code", filters.countries);
    if (filters?.cities?.length) query = query.in("city", filters.cities);
    if (filters?.partnerTypes?.length) query = query.in("partner_type", filters.partnerTypes as string[]);
    if (filters?.favorites) query = query.eq("is_favorite", true);

    return query.order("company_name").range(from, to);
  });
}

export async function findPartnersByCountry(countryCode: string): Promise<PartnerWithRelations[]> {
  return fetchAllRows((from, to) =>
    supabase
      .from("partners")
      .select(`*, partner_services (service_category), partner_certifications (certification)`)
      .eq("is_active", true)
      .eq("country_code", countryCode)
      .order("company_name")
      .range(from, to)
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

export async function updatePartner(id: string, updates: Record<string, unknown>) {
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
        .eq("is_active", true)
        .range(from, to)
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
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);
  if (error) throw error;
  return count ?? 0;
}

/** Get distinct country codes from active partners */
export async function getDistinctCountries() {
  const { data, error } = await supabase
    .from("partners")
    .select("country_code")
    .eq("is_active", true);
  if (error) throw error;
  const unique = new Set((data ?? []).map(r => r.country_code));
  return [...unique];
}

/** Search partners by name (for command palette, autocomplete) */
export async function searchPartners(term: string, limit = 10) {
  const s = sanitizeSearchTerm(term);
  if (!s) return [];
  const { data, error } = await supabase
    .from("partners")
    .select("id, company_name, country_code, city, logo_url")
    .ilike("company_name", `%${s}%`)
    .eq("is_active", true)
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

// ─── Cache Invalidation ────────────────────────────────
export function invalidatePartnerCache(qc: QueryClient, partnerId?: string) {
  qc.invalidateQueries({ queryKey: queryKeys.partners.all });
  qc.invalidateQueries({ queryKey: queryKeys.partnerStats });
  if (partnerId) {
    qc.invalidateQueries({ queryKey: queryKeys.partner(partnerId) });
  }
}
