/**
 * DAL — Viste operative Download (partner scaricati, cache directory, terminal log).
 * Estratto da src/components/download/**: filtri, ordinamenti e semantica invariati.
 */
import { supabase } from "@/integrations/supabase/client";

export async function findPartnersWithContactsByWcaIds(wcaIds: number[]): Promise<unknown[]> {
  const { data, error } = await supabase
    .from("partners")
    .select(`
            id, wca_id, company_name, city, country_code, email, phone,
            partner_contacts (id, name, title, email, direct_phone, mobile, is_primary)
          `)
    .in("wca_id", wcaIds)
    .order("company_name");
  if (error) throw error;
  return data ?? [];
}

export async function findDirectoryCacheMembers(countryCode: string): Promise<{ members: unknown }[]> {
  const { data } = await supabase
    .from("directory_cache")
    .select("members")
    .eq("country_code", countryCode);
  return data ?? [];
}

export async function findLiveProfilePartners(wcaIds: number[]): Promise<unknown[]> {
  const { data } = await supabase
    .from("partners")
    .select("id, company_name, city, country_code, email, phone, website, wca_id, partner_networks(network_name), partner_contacts(name, email, title)")
    .in("wca_id", wcaIds);
  return data ?? [];
}

export async function findAgendaPartnersByCountry(countryCode: string): Promise<unknown[]> {
  const { data } = await supabase
    .from("partners")
    .select("id, company_name, city, country_code, email, phone, wca_id, partner_networks(network_name), partner_contacts(name, email, mobile)")
    .eq("country_code", countryCode)
    .order("company_name");
  return data ?? [];
}

export async function getDownloadJobTerminalLog(jobId: string): Promise<unknown> {
  const { data } = await supabase
    .from("download_jobs")
    .select("terminal_log")
    .eq("id", jobId)
    .single();
  return data?.terminal_log ?? null;
}
