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
