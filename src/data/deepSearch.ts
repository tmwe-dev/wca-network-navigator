/**
 * DAL — Deep search across partners / imported_contacts / prospects
 */
import { supabase } from "@/integrations/supabase/client";

export interface DeepSearchPartnerRow {
  readonly id: string;
  readonly company_name: string;
  readonly country_name: string | null;
}

export interface DeepSearchContactRow {
  readonly id: string;
  readonly name: string | null;
  readonly company_name: string | null;
}

export interface DeepSearchProspectRow {
  readonly id: string;
  readonly company_name: string;
  readonly city: string | null;
}

export async function searchPartnersDeep(query: string, limit = 10): Promise<DeepSearchPartnerRow[]> {
  const { data } = await supabase
    .from("partners")
    .select("id, company_name, country_name")
    .ilike("company_name", `%${query}%`)
    .limit(limit);
  return data ?? [];
}

export async function searchContactsDeep(query: string, limit = 10): Promise<DeepSearchContactRow[]> {
  const { data } = await supabase
    .from("imported_contacts")
    .select("id, name, company_name")
    .or(`name.ilike.%${query}%,company_name.ilike.%${query}%`)
    .limit(limit);
  return data ?? [];
}

export async function searchProspectsDeep(query: string, limit = 10): Promise<DeepSearchProspectRow[]> {
  const { data } = await supabase
    .from("prospects")
    .select("id, company_name, city")
    .ilike("company_name", `%${query}%`)
    .limit(limit);
  return data ?? [];
}
