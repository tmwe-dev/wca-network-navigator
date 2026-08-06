/**
 * DAL — record unificato contatto (partner / imported_contact / prospect / business_card).
 */
import { supabase } from "@/integrations/supabase/client";

export type PartnerRecordRow = Record<string, unknown> & {
  id: string;
  company_name: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  country_name: string | null;
  city: string | null;
  address: string | null;
  website: string | null;
  lead_status: string;
  profile_description: string | null;
  enrichment_data: unknown;
  enriched_at: string | null;
  created_at: string | null;
  last_interaction_at: string | null;
  interaction_count: number;
  company_alias: string | null;
};

export async function findPartnerRecord(id: string): Promise<PartnerRecordRow | null> {
  const { data, error } = await supabase
    .from("partners")
    .select("*, partner_contacts(*), partner_social_links(*)")
    .eq("id", id)
    .single();
  if (error || !data) return null;
  return data as PartnerRecordRow;
}

export async function findImportedContactRecord(id: string) {
  const { data, error } = await supabase.from("imported_contacts").select("*").eq("id", id).single();
  if (error || !data) return null;
  return data;
}

export async function findProspectRecord(id: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase.from("prospects").select("*, prospect_contacts(*)").eq("id", id).single();
  if (error || !data) return null;
  return data as Record<string, unknown>;
}

export async function findBusinessCardRecord(id: string) {
  const { data, error } = await supabase.from("business_cards").select("*").eq("id", id).single();
  if (error || !data) return null;
  return data;
}
