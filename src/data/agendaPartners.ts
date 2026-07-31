/**
 * DAL — Agenda partner views (lista + card).
 * Estratto da src/components/agenda/**: query, ordinamenti e limiti invariati.
 */
import { supabase } from "@/integrations/supabase/client";

export interface AgendaPartnerRelationsRow {
  id: string;
  partner_networks: { network_name: string | null }[];
  partner_contacts: { name: string | null; email: string | null; mobile: string | null }[];
}

export interface AgendaPartnerCardRow {
  id: string;
  company_name: string;
  city: string | null;
  country_code: string | null;
  country_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  wca_id: string | null;
  lead_status: string | null;
  partner_networks: { network_name: string | null }[];
  partner_contacts: { name: string | null; email: string | null; mobile: string | null; title: string | null }[];
}

export async function findAgendaPartnerRelations(partnerIds: string[]): Promise<AgendaPartnerRelationsRow[]> {
  const { data } = await supabase
    .from("partners")
    .select("id, partner_networks(network_name), partner_contacts(name, email, mobile)")
    .in("id", partnerIds);
  return data ?? [];
}

export async function findAgendaPartnerCards(limit: number): Promise<AgendaPartnerCardRow[]> {
  const { data } = await supabase
    .from("partners")
    .select(
      "id, company_name, city, country_code, country_name, email, phone, website, wca_id, lead_status, partner_networks(network_name), partner_contacts(name, email, mobile, title)"
    )
    .order("updated_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
