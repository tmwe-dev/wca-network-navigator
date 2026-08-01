/**
 * DAL — Agenda partner views (lista + card).
 * Estratto da src/components/agenda/**: query, ordinamenti e limiti invariati.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type PartnerRowDb = Database["public"]["Tables"]["partners"]["Row"];
type NetworkRowDb = Database["public"]["Tables"]["partner_networks"]["Row"];
type ContactRowDb = Database["public"]["Tables"]["partner_contacts"]["Row"];

export interface AgendaPartnerRelationsRow {
  id: string;
  partner_networks: Pick<NetworkRowDb, "network_name">[];
  partner_contacts: Pick<ContactRowDb, "name" | "email" | "mobile">[];
}

export type AgendaPartnerCardRow = Pick<
  PartnerRowDb,
  | "id"
  | "company_name"
  | "city"
  | "country_code"
  | "country_name"
  | "email"
  | "phone"
  | "website"
  | "wca_id"
  | "lead_status"
> & {
  partner_networks: Pick<NetworkRowDb, "network_name">[];
  partner_contacts: Pick<ContactRowDb, "name" | "email" | "mobile" | "title">[];
};

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
