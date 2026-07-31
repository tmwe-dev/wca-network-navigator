/**
 * DAL — Queries for useEmailContactPicker.
 */
import { supabase } from "@/integrations/supabase/client";
import type { PartnerRow, PartnerContactRow, ImportedContactRow, BcaRow } from "@/types/email-picker";

export async function findPickerPartners(search: string, selectedCountry: string | null): Promise<PartnerRow[]> {
  let q = supabase.from("partners").select("id, company_name, company_alias, country_code, city, lead_status");
  if (search.length >= 3) q = q.ilike("company_name", `%${search}%`);
  if (selectedCountry) q = q.eq("country_code", selectedCountry);
  q = q.eq("is_active", true);
  const { data, error } = await q.order("company_name").limit(200);
  if (error) throw error;
  return (data ?? []) as PartnerRow[];
}

export async function findPickerPartnerContacts(partnerId: string): Promise<PartnerContactRow[]> {
  const { data, error } = await supabase
    .from("partner_contacts")
    .select("id, name, contact_alias, email, title")
    .eq("partner_id", partnerId)
    .order("is_primary", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as PartnerContactRow[];
}

export async function findPickerContacts(
  search: string,
  countryName: string | null,
  originFilter: string,
): Promise<ImportedContactRow[]> {
  let q = supabase
    .from("imported_contacts")
    .select("id, name, company_name, email, country, contact_alias, company_alias, lead_status, origin, position");
  if (search.length >= 3) q = q.or(`name.ilike.%${search}%,company_name.ilike.%${search}%,email.ilike.%${search}%`);
  if (countryName) q = q.ilike("country", `%${countryName}%`);
  if (originFilter !== "all") q = q.eq("origin", originFilter);
  const { data, error } = await q.limit(200);
  if (error) throw error;
  return (data ?? []) as ImportedContactRow[];
}

export async function findPickerBcaCards(search: string, countryName: string | null): Promise<BcaRow[]> {
  let q = supabase
    .from("business_cards")
    .select("id, contact_name, company_name, email, location, matched_partner_id, lead_status");
  if (search.length >= 3) {
    q = q.or(`contact_name.ilike.%${search}%,company_name.ilike.%${search}%,email.ilike.%${search}%`);
  }
  if (countryName) q = q.ilike("location", `%${countryName}%`);
  const { data, error } = await q.limit(200);
  if (error) throw error;
  return (data ?? []) as BcaRow[];
}
