/**
 * WCA Scraper — Migrato a wca-app bridge
 * 🤖 Claude Engine V8 — Diario di bordo #5
 *
 * Tutte le funzioni ora usano wca-app.vercel.app invece di Edge Functions Supabase.
 * Le interfacce restano identiche per compatibilità con ActionPanel, WcaBrowser, etc.
 */

import { wcaScrape, wcaDiscover } from "@/lib/wca-app-bridge";

// ─── Helper: get cached WCA cookie or login fresh ──────────────

async function getOrRefreshCookie(): Promise<string> {
  try {
    const cached = localStorage.getItem("wca_session_cookie");
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.cookie && Date.now() - parsed.savedAt < 8 * 60 * 1000) {
        return parsed.cookie;
      }
    }
  } catch {}

  console.log("[CLAUDE-SCRAPER] Login via wca-app.vercel.app...");
  const res = await fetch("https://wca-app.vercel.app/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const data = await res.json();
  if (!data.success || !data.cookies) {
    throw new Error(data.error || "Login WCA fallito via wca-app");
  }
  try {
    localStorage.setItem("wca_session_cookie", JSON.stringify({ cookie: data.cookies, savedAt: Date.now() }));
  } catch {}
  return data.cookies;
}

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

/** Scrape singolo partner via wca-app bridge */
export async function scrapeWcaPartnerById(wcaId: number): Promise<ScrapeSingleResult> {
  try {
    const cookie = await getOrRefreshCookie();
    const result = await wcaScrape(wcaId, cookie);

    if (!result.success) {
      return { success: false, wcaId, error: result.error || "Scrape fallito" };
    }

    return {
      success: true,
      found: result.found ?? true,
      wcaId,
      partner: result.partner as ScrapedPartner | undefined,
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

/** Preview profilo via wca-app bridge */
export async function previewWcaProfile(wcaId: number): Promise<PreviewResult> {
  try {
    const cookie = await getOrRefreshCookie();
    const result = await wcaScrape(wcaId, cookie);

    if (!result.success) {
      return { success: false, wcaId, authStatus: "login_failed", error: result.error || "Preview fallito" };
    }

    if (!result.found) {
      return { success: true, found: false, wcaId, authStatus: "authenticated" };
    }

    const p = result.partner as any;
    return {
      success: true,
      found: true,
      wcaId,
      authStatus: "authenticated",
      partner: p ? {
        company_name: p.company_name || "",
        city: p.city || "",
        country: p.country_name || "",
        country_code: p.country_code || "",
        office_type: p.office_type || "",
        email: p.email || null,
        phone: p.phone || null,
        website: p.website || null,
        networks: p.networks || [],
        contacts: p.contacts || [],
      } : undefined,
      contactsFound: p?.contacts?.length || 0,
      totalContacts: p?.contacts?.length || 0,
    };
  } catch (err) {
    return { success: false, wcaId, authStatus: "login_failed", error: err instanceof Error ? err.message : "Errore di rete" };
  }
}

/** Scan directory WCA per paese via wca-app bridge */
export async function scrapeWcaDirectory(
  countryCode: string,
  network?: string,
  pageIndex?: number,
  pageSize?: number
): Promise<DirectoryResult> {
  try {
    const cookie = await getOrRefreshCookie();
    const result = await wcaDiscover(countryCode, pageIndex || 1, cookie);

    const members: DirectoryMember[] = (result.members || []).map(m => ({
      company_name: m.name || m.company || "",
      city: undefined,
      country: undefined,
      country_code: countryCode,
      wca_id: m.id,
    }));

    return {
      success: true,
      members,
      pagination: {
        total_results: members.length * (result.totalPages || 1),
        current_page: result.page || pageIndex || 1,
        total_pages: result.totalPages || 1,
        has_next_page: (result.page || 1) < (result.totalPages || 1),
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
