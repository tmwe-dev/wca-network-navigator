/**
 * DAL — Email Forge Lab recipient picker (partner / imported_contacts / business_cards).
 */
import { supabase } from "@/integrations/supabase/client";

export async function findForgePickerPartners(params: {
  search: string;
  country: string | null;
  limit: number;
}) {
  let q = supabase
    .from("partners")
    .select("id, company_name, country_code, city, email, website, linkedin_url", { count: "exact" })
    .eq("is_active", true)
    .order("company_name", { ascending: true })
    .limit(params.limit);
  if (params.search.length >= 2) q = q.ilike("company_name", `%${params.search}%`);
  if (params.country) q = q.eq("country_code", params.country);
  const { data, count } = await q;
  return { rows: data ?? [], total: count ?? (data?.length ?? 0) };
}

export async function findForgePickerContacts(params: {
  search: string;
  countryName: string | null;
  limit: number;
}) {
  let q = supabase
    .from("imported_contacts")
    .select("id, name, company_name, email, country, position", { count: "exact" })
    .order("name", { ascending: true })
    .limit(params.limit);
  if (params.search.length >= 2) {
    q = q.or(`name.ilike.%${params.search}%,company_name.ilike.%${params.search}%,email.ilike.%${params.search}%`);
  }
  if (params.countryName) q = q.ilike("country", `%${params.countryName}%`);
  const { data, count } = await q;
  return { rows: data ?? [], total: count ?? (data?.length ?? 0) };
}

export async function findForgePickerBca(params: { search: string; limit: number }) {
  let q = supabase
    .from("business_cards")
    .select("id, contact_name, company_name, email, location, matched_partner_id", { count: "exact" })
    .order("company_name", { ascending: true })
    .limit(params.limit);
  if (params.search.length >= 2) {
    q = q.or(`contact_name.ilike.%${params.search}%,company_name.ilike.%${params.search}%,email.ilike.%${params.search}%`);
  }
  const { data, count } = await q;
  return { rows: data ?? [], total: count ?? (data?.length ?? 0) };
}
