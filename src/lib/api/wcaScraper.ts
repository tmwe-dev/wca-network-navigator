/**
 * WCA Scraper — Facade che usa wcaAppApi centralizzato
 * 🤖 Claude Engine V8 — Zero duplicazione, import da wcaAppApi
 *
 * Le interfacce restano identiche per compatibilità con WcaBrowser, ResyncConfigure, etc.
 * Tutte le chiamate passano per wcaAppApi.ts.
 */

import { wcaScrape, wcaDiscover, wcaLogin } from "@/lib/api/wcaAppApi";

// ─── Types (invariati) ─────────────────────────────────────────

export interface PartnerNetwork {
  name: string;
  expires?: string;
}

export interface PartnerContact {
  title: string;
  name?: string;
  email?: string;
}

export interface BranchOffice {
  city: string;
  wca_id?: number;
}

export interface AIClassification {
  summary: string;
  services: string[];
  partner_type: string;
  rating?: number;
  rating_details?: {
    website_quality: number;
    service_mix: number;
    network_size: number;
    seniority: number;
    international: number;
    linkedin_presence: number;
    company_profile: number;
  };
}

export interface ScrapedPartner {
  company_name: string;
  city: string;
  country_code: string;
  country_name: string;
  office_type?: string;
  email?: string;
  phone?: string;
  fax?: string;
  website?: string;
  wca_id?: number;
  address?: string;
  profile_description?: string;
  logo_url?: string;
  member_since?: string;
  gold_medallion?: boolean;
  has_branches?: boolean;
  networks?: PartnerNetwork[];
  certifications?: string[];
  contacts?: PartnerContact[];
  branch_offices?: BranchOffice[];
}

export interface ScrapeSingleResult {
  success: boolean;
  found?: boolean;
  wcaId: number;
  action?: "inserted" | "updated" | "skipped";
  partnerId?: string;
  partner?: ScrapedPartner;
  aiClassification?: AIClassification;
  error?: string;
}

/** Scrape singolo partner — via wcaAppApi centralizzato (SSO auto) */
export async function scrapeWcaPartnerById(wcaId: number): Promise<ScrapeSingleResult> {
  try {
    const data = await wcaScrape([wcaId]);

    if (!data.success || !data.results || data.results.length === 0) {
      return { success: false, wcaId, error: data.error || "Scrape fallito" };
    }

    const profile = data.results[0];
    const found = profile.state === "ok" && !!profile.company_name;

    return {
      success: true,
      found,
      wcaId,
      partner: profile as unknown as ScrapedPartner | undefined,
    };
  } catch (err) {
    return { success: false, wcaId, error: err instanceof Error ? err.message : "Errore di rete" };
  }
}

// ─── Directory Listing Types ─────────────────────────────────

export interface DirectoryMember {
  company_name: string;
  city?: string;
  country?: string;
  country_code?: string;
  wca_id?: number;
  network_memberships?: string[];
}

export interface DirectoryResult {
  success: boolean;
  members: DirectoryMember[];
  pagination: {
    total_results: number;
    current_page: number;
    total_pages: number;
    has_next_page: boolean;
  };
  error?: string;
}

export interface PreviewResult {
  success: boolean;
  found?: boolean;
  wcaId: number;
  authStatus: "authenticated" | "members_only" | "no_credentials" | "login_failed";
  authDetails?: string;
  partner?: {
    company_name: string;
    city: string;
    country: string;
    country_code: string;
    office_type: string;
    email: string | null;
    phone: string | null;
    website: string | null;
    networks: { name: string; expires?: string }[];
    contacts: { title: string; name?: string; email?: string; phone?: string; mobile?: string }[];
  };
  contactsFound?: number;
  totalContacts?: number;
  htmlSnippet?: string;
  error?: string;
}

/** Preview profilo — via wcaAppApi centralizzato (SSO auto) */
export async function previewWcaProfile(wcaId: number): Promise<PreviewResult> {
  try {
    const data = await wcaScrape([wcaId]);

    if (!data.success || !data.results || data.results.length === 0) {
      return { success: false, wcaId, authStatus: "login_failed", error: data.error || "Preview fallito" };
    }

    const p = data.results[0];
    const found = p.state === "ok" && !!p.company_name;

    if (!found) {
      return { success: true, found: false, wcaId, authStatus: "authenticated" };
    }

    return {
      success: true,
      found: true,
      wcaId,
      authStatus: "authenticated",
      partner: {
        company_name: p.company_name || "",
        city: (p.address || "").split(",")[0]?.trim() || "",
        country: p.country_code || "",
        country_code: p.country_code || "",
        office_type: p.branch || "",
        email: p.email || null,
        phone: p.phone || null,
        website: p.website || null,
        networks: (p.networks || []).map((n: unknown) => typeof n === "string" ? { name: n } : n),
        contacts: (p.contacts || []) as unknown[],
      },
      contactsFound: p.contacts?.length || 0,
      totalContacts: p.contacts?.length || 0,
    };
  } catch (err) {
    return { success: false, wcaId, authStatus: "login_failed", error: err instanceof Error ? err.message : "Errore di rete" };
  }
}

/** Scan directory WCA per paese — via wcaAppApi centralizzato */
export async function scrapeWcaDirectory(
  countryCode: string,
  network?: string,
  pageIndex?: number,
  pageSize?: number
): Promise<DirectoryResult> {
  try {
    const result = await wcaDiscover(countryCode, pageIndex || 1);

    const members: DirectoryMember[] = (result.members || []).map((m: { id: number; name?: string; company?: string }) => ({
      company_name: m.name || m.company || "",
      city: undefined,
      country: undefined,
      country_code: countryCode,
      wca_id: m.id,
    }));

    const totalResults = result.totalResults || members.length;
    const totalPages = Math.ceil((totalResults || 1) / 50) || 1;
    const currentPage = result.page || pageIndex || 1;

    return {
      success: true,
      members,
      pagination: {
        total_results: totalResults || 0,
        current_page: currentPage,
        total_pages: totalPages,
        has_next_page: result.hasNext || currentPage < totalPages,
      },
    };
  } catch (err) {
    return {
      success: false,
      members: [],
      pagination: { total_results: 0, current_page: 1, total_pages: 1, has_next_page: false },
      error: err instanceof Error ? err.message : "Errore di rete",
    };
  }
}
