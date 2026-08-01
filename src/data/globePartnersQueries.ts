/**
 * DAL — Queries for the partners globe visualization (usePartnersForGlobe).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type PartnersRow = Database["public"]["Tables"]["partners"]["Row"];
export type GlobePartnerRow = Pick<
  PartnersRow,
  "id" | "company_name" | "city" | "country_code" | "country_name" | "email" | "partner_type"
>;

const SELECT = "id, company_name, city, country_code, country_name, email, partner_type";
const PAGE_SIZE = 2000;

export async function getAllActivePartnersForGlobe(): Promise<GlobePartnerRow[]> {
  let all: GlobePartnerRow[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("partners")
      .select(SELECT)
      .eq("is_active", true)
      .order("company_name")
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return all;
}

export async function getActivePartnersByCountryForGlobe(countryCode: string): Promise<GlobePartnerRow[]> {
  let all: GlobePartnerRow[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("partners")
      .select(SELECT)
      .eq("is_active", true)
      .eq("country_code", countryCode)
      .order("company_name")
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return all;
}

export interface BusinessCardCampaignRow {
  id: string;
  company_name: string | null;
  contact_name: string | null;
  email: string | null;
  event_name: string | null;
  met_at: string | null;
  location: string | null;
  matched_partner_id: string | null;
  partner: {
    id: string;
    company_name: string;
    city: string;
    country_code: string;
    country_name: string;
    email: string | null;
    logo_url: string | null;
  } | null;
}

export async function getBusinessCardsForCampaignRaw(): Promise<BusinessCardCampaignRow[]> {
  const { data, error } = await supabase
    .from("business_cards")
    .select(
      "id, company_name, contact_name, email, event_name, met_at, location, matched_partner_id, partner:matched_partner_id(id, company_name, city, country_code, country_name, email, logo_url)"
    )
    .order("created_at", { ascending: false })
    .limit(1000)
    .returns<BusinessCardCampaignRow[]>();
  if (error) throw error;
  return data ?? [];
}

export async function getBcaCountryCountsRaw(): Promise<Array<{ matched_partner_id: string | null; partner: { country_code: string | null } | null }>> {
  const { data, error } = await supabase
    .from("business_cards")
    .select("matched_partner_id, partner:matched_partner_id(country_code)")
    .not("matched_partner_id", "is", null)
    .returns<Array<{ matched_partner_id: string | null; partner: { country_code: string | null } | null }>>();
  if (error) throw error;
  return data ?? [];
}
