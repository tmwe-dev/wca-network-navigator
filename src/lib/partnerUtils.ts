import { getYearsMember } from "@/lib/countries";
import { getPartnerContactQuality } from "@/hooks/useContactCompleteness";

/** Typed shape for partner.enrichment_data JSON field */
export interface EnrichmentData {
  deep_search_at?: string | null;
  logo_url?: string;
  ai_profile?: { headline?: string; sector?: string; summary?: string; [key: string]: unknown };
  social_links?: Array<{ platform?: string; url?: string; [key: string]: unknown }>;
  key_markets?: string[];
  key_routes?: string[];
  warehouse_sqm?: number;
  employee_count?: number;
  founding_year?: number;
  has_own_fleet?: boolean;
  fleet_details?: string;
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

/** Shape of a partner row for partnerUtils functions */
export interface PartnerLike {
  logo_url?: string | null;
  enrichment_data?: unknown;
  mobile?: string | null;
  partner_contacts?: Array<Record<string, unknown>>;
  partner_social_links?: Array<Record<string, unknown>>;
  branch_cities?: unknown[];
  country_code?: string;
  company_name?: string;
  country_name?: string;
  rating?: number | null;
  member_since?: string | null;
  [key: string]: unknown;
}

/** Resolve effective logo: partner.logo_url → enrichment_data.logo_url → null */
export function getEffectiveLogoUrl(partner: PartnerLike): string | null {
  if (partner.logo_url) return partner.logo_url;
  const enrich = asEnrichment(partner.enrichment_data);
  if (enrich && typeof enrich.logo_url === "string" && enrich.logo_url) {
    return enrich.logo_url;
  }
  return null;
}

/** Extract enrichment snippet for card display */
export function getEnrichmentSnippet(partner: PartnerLike): string | null {
  const enrich = asEnrichment(partner.enrichment_data);
  if (!enrich) return null;
  const profile = enrich.ai_profile;
  if (profile?.headline) return profile.headline;
  if (profile?.sector) return profile.sector;
  if (profile?.summary) return String(profile.summary).slice(0, 80);
  return null;
}

/** Check if partner has LinkedIn social link */
export function hasLinkedIn(partner: PartnerLike): boolean {
  if (partner.partner_social_links?.some?.((l) => l.platform === "linkedin" || l.platform === "linkedin_company")) return true;
  const enrich = asEnrichment(partner.enrichment_data);
  if (enrich?.social_links?.some?.((l) => l.platform?.includes?.("linkedin"))) return true;
  return false;
}

/** Check WhatsApp availability (has mobile/phone) */
export function hasWhatsApp(partner: PartnerLike): boolean {
  if (partner.mobile) return true;
  const contacts = partner.partner_contacts || [];
  return contacts.some((c) => c.mobile);
}

export type SortOption =
  | "name_asc"
  | "name_desc"
  | "rating_desc"
  | "years_desc"
  | "country_asc"
  | "branches_desc"
  | "contacts_desc";

export function getBranchCountries(partner: PartnerLike): { code: string; name: string }[] {
  if (!partner.branch_cities || !Array.isArray(partner.branch_cities)) return [];
  const map = new Map<string, string>();
  partner.branch_cities.forEach((b: unknown) => {
    const item = b as Record<string, unknown> | null;
    const code = item?.country_code || item?.country;
    if (typeof code === "string" && code !== partner.country_code) {
      map.set(code, typeof item?.country_name === "string" ? item.country_name : code);
    }
  });
  return Array.from(map.entries()).map(([code, name]) => ({ code, name }));
}

export function sortPartners(partners: PartnerLike[], sortBy: SortOption): PartnerLike[] {
  const sorted = [...partners];
  switch (sortBy) {
    case "name_asc": return sorted.sort((a, b) => (a.company_name ?? "").localeCompare(b.company_name ?? ""));
    case "name_desc": return sorted.sort((a, b) => (b.company_name ?? "").localeCompare(a.company_name ?? ""));
    case "rating_desc": return sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    case "years_desc": return sorted.sort((a, b) => getYearsMember(b.member_since) - getYearsMember(a.member_since));
    case "country_asc": return sorted.sort((a, b) => (a.country_name ?? "").localeCompare(b.country_name ?? ""));
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
