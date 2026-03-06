import { getYearsMember } from "@/lib/countries";
import { getPartnerContactQuality } from "@/hooks/useContactCompleteness";

/** Typed shape for partner.enrichment_data JSON field */
export interface EnrichmentData {
  deep_search_at?: string | null;
  tokens_used?: {
    credits_consumed?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/** Safely cast enrichment_data from Json to EnrichmentData */
export function asEnrichment(data: unknown): EnrichmentData | null {
  if (!data || typeof data !== "object") return null;
  return data as EnrichmentData;
}

/** Directory cache member shape */
export interface DirectoryCacheMember {
  wca_id?: number;
  company_name?: string;
  city?: string;
  [key: string]: unknown;
}

/** Returns the logo URL as-is if present */
export function getRealLogoUrl(logoUrl: string | null | undefined): string | null {
  if (!logoUrl) return null;
  return logoUrl;
}

export type SortOption =
  | "name_asc"
  | "name_desc"
  | "rating_desc"
  | "years_desc"
  | "country_asc"
  | "branches_desc"
  | "contacts_desc";

export function getBranchCountries(partner: any): { code: string; name: string }[] {
  if (!partner.branch_cities || !Array.isArray(partner.branch_cities)) return [];
  const map = new Map<string, string>();
  partner.branch_cities.forEach((b: any) => {
    const code = b?.country_code || b?.country;
    if (code && code !== partner.country_code) {
      map.set(code, b?.country_name || code);
    }
  });
  return Array.from(map.entries()).map(([code, name]) => ({ code, name }));
}

export function sortPartners(partners: any[], sortBy: SortOption): any[] {
  const sorted = [...partners];
  switch (sortBy) {
    case "name_asc": return sorted.sort((a, b) => a.company_name.localeCompare(b.company_name));
    case "name_desc": return sorted.sort((a, b) => b.company_name.localeCompare(a.company_name));
    case "rating_desc": return sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    case "years_desc": return sorted.sort((a, b) => getYearsMember(b.member_since) - getYearsMember(a.member_since));
    case "country_asc": return sorted.sort((a, b) => a.country_name.localeCompare(b.country_name));
    case "branches_desc": return sorted.sort((a, b) => {
      const ba = Array.isArray(b.branch_cities) ? b.branch_cities.length : 0;
      const aa = Array.isArray(a.branch_cities) ? a.branch_cities.length : 0;
      return ba - aa;
    });
    case "contacts_desc": return sorted.sort((a, b) => {
      const qa = getPartnerContactQuality(a.partner_contacts);
      const qb = getPartnerContactQuality(b.partner_contacts);
      const order: Record<string, number> = { complete: 0, partial: 1, missing: 2 };
      return (order[qa] || 2) - (order[qb] || 2);
    });
    default: return sorted;
  }
}
