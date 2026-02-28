import { supabase } from "@/integrations/supabase/client";

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

export async function scrapeWcaPartnerById(wcaId: number): Promise<ScrapeSingleResult> {
  const { data, error } = await supabase.functions.invoke("scrape-wca-partners", {
    body: { wcaId },
  });

  if (error) {
    return { success: false, wcaId, error: error.message };
  }

  return data as ScrapeSingleResult;
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

export async function previewWcaProfile(wcaId: number): Promise<PreviewResult> {
  const { data, error } = await supabase.functions.invoke("scrape-wca-partners", {
    body: { wcaId, preview: true },
  });

  if (error) {
    return { success: false, wcaId, authStatus: "login_failed", error: error.message };
  }

  return data as PreviewResult;
}

export async function scrapeWcaDirectory(
  countryCode: string,
  network?: string,
  pageIndex?: number,
  pageSize?: number
): Promise<DirectoryResult> {
  const { data, error } = await supabase.functions.invoke("scrape-wca-directory", {
    body: { countryCode, network: network || "", pageIndex: pageIndex || 1, pageSize: pageSize || 50 },
  });

  if (error) {
    return {
      success: false,
      members: [],
      pagination: { total_results: 0, current_page: 1, total_pages: 1, has_next_page: false },
      error: error.message,
    };
  }

  return data as DirectoryResult;
}
