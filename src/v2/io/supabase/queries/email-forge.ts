/**
 * IO Queries: Email Forge Lab — recipient picker + enrichment inspection.
 * Raw (non-Result) shape preserved to keep parity with pre-existing hooks.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { PostgrestError } from "@supabase/supabase-js";

type PostgrestListResult<T> = { data: T[] | null; count: number | null; error: PostgrestError | null };
type PostgrestSingleResult<T> = { data: T | null; error: PostgrestError | null };

export type ForgePartnerRow = Pick<
  Database["public"]["Tables"]["partners"]["Row"],
  "id" | "company_name" | "country_code" | "city" | "email" | "website" | "linkedin_url"
>;

export async function fetchForgePartners(params: {
  search: string;
  country: string | null;
  limit: number;
}): Promise<PostgrestListResult<ForgePartnerRow>> {
  let q = supabase
    .from("partners")
    .select("id, company_name, country_code, city, email, website, linkedin_url", { count: "exact" })
    .eq("is_active", true)
    .order("company_name", { ascending: true })
    .limit(params.limit);
  if (params.search.length >= 2) q = q.ilike("company_name", `%${params.search}%`);
  if (params.country) q = q.eq("country_code", params.country);
  return q;
}

export type ForgeContactRow = Pick<
  Database["public"]["Tables"]["imported_contacts"]["Row"],
  "id" | "name" | "company_name" | "email" | "country" | "position"
>;

export async function fetchForgeContacts(params: {
  search: string;
  countryName: string | null;
  limit: number;
}): Promise<PostgrestListResult<ForgeContactRow>> {
  let q = supabase
    .from("imported_contacts")
    .select("id, name, company_name, email, country, position", { count: "exact" })
    .order("name", { ascending: true })
    .limit(params.limit);
  if (params.search.length >= 2) {
    q = q.or(`name.ilike.%${params.search}%,company_name.ilike.%${params.search}%,email.ilike.%${params.search}%`);
  }
  if (params.countryName) {
    q = q.ilike("country", `%${params.countryName}%`);
  }
  return q;
}

export type ForgeBcaRow = Pick<
  Database["public"]["Tables"]["business_cards"]["Row"],
  "id" | "contact_name" | "company_name" | "email" | "location" | "matched_partner_id"
>;

export async function fetchForgeBusinessCards(params: {
  search: string;
  limit: number;
}): Promise<PostgrestListResult<ForgeBcaRow>> {
  let q = supabase
    .from("business_cards")
    .select("id, contact_name, company_name, email, location, matched_partner_id", { count: "exact" })
    .order("company_name", { ascending: true })
    .limit(params.limit);
  if (params.search.length >= 2) {
    q = q.or(`contact_name.ilike.%${params.search}%,company_name.ilike.%${params.search}%,email.ilike.%${params.search}%`);
  }
  return q;
}

export type ForgePartnerEnrichmentRow = Pick<
  Database["public"]["Tables"]["partners"]["Row"],
  "id" | "enrichment_data" | "profile_description" | "raw_profile_html" | "raw_profile_markdown" | "ai_parsed_at"
>;

export async function fetchForgePartnerEnrichment(partnerId: string): Promise<PostgrestSingleResult<ForgePartnerEnrichmentRow>> {
  return supabase
    .from("partners")
    .select("id, enrichment_data, profile_description, raw_profile_html, raw_profile_markdown, ai_parsed_at")
    .eq("id", partnerId)
    .maybeSingle();
}

export type ForgeContactEnrichmentRow = Pick<
  Database["public"]["Tables"]["imported_contacts"]["Row"],
  "id" | "enrichment_data" | "deep_search_at"
>;

export async function fetchForgeContactEnrichment(contactId: string): Promise<PostgrestSingleResult<ForgeContactEnrichmentRow>> {
  return supabase
    .from("imported_contacts")
    .select("id, enrichment_data, deep_search_at")
    .eq("id", contactId)
    .maybeSingle();
}

export type ForgeBcaEnrichmentRow = Pick<
  Database["public"]["Tables"]["business_cards"]["Row"],
  "id" | "raw_data" | "ocr_confidence"
>;

export async function fetchForgeBcaEnrichment(bcaId: string): Promise<PostgrestSingleResult<ForgeBcaEnrichmentRow>> {
  return supabase
    .from("business_cards")
    .select("id, raw_data, ocr_confidence")
    .eq("id", bcaId)
    .maybeSingle();
}
