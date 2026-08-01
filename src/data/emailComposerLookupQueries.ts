/** DAL — Queries for useEmailComposerState prefill lookups. */
import { supabase } from "@/integrations/supabase/client";

export interface ComposerPartnerRow {
  id: string;
  company_name: string;
  company_alias: string | null;
  country_code: string | null;
  city: string | null;
}

export async function findPartnerForComposerPrefill(partnerId: string): Promise<ComposerPartnerRow | null> {
  const { data } = await supabase
    .from("partners")
    .select("id, company_name, company_alias, country_code, city")
    .eq("id", partnerId)
    .maybeSingle();
  return data as ComposerPartnerRow | null;
}

export interface ComposerPartnerContactRow {
  name: string | null;
  contact_alias: string | null;
  email: string | null;
}

export async function findFirstPartnerContactWithEmail(partnerId: string): Promise<ComposerPartnerContactRow | null> {
  const { data } = await supabase
    .from("partner_contacts")
    .select("name, contact_alias, email")
    .eq("partner_id", partnerId)
    .not("email", "is", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data as ComposerPartnerContactRow | null;
}
