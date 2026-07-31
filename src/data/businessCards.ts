/**
 * DAL — business_cards
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { QueryClient } from "@tanstack/react-query";

type BCInsert = Database["public"]["Tables"]["business_cards"]["Insert"];
type BCUpdate = Database["public"]["Tables"]["business_cards"]["Update"];

export const businessCardKeys = {
  all: ["business-cards"] as const,
  matches: ["business-card-matches"] as const,
};

export async function findBusinessCards(filters?: { event_name?: string; match_status?: string }) {
  let q = supabase
    .from("business_cards")
    .select("*, partner:matched_partner_id(id, company_name, logo_url, website, company_alias, enrichment_data, country_code, lead_status)")
    .order("created_at", { ascending: false });
  if (filters?.event_name) q = q.ilike("event_name", `%${filters.event_name}%`);
  if (filters?.match_status) q = q.eq("match_status", filters.match_status);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function findBusinessCardByEmail(email: string) {
  const { data, error } = await supabase
    .from("business_cards")
    .select("company_name, contact_name, location, matched_partner_id")
    .ilike("email", email)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function findMatchedPartnerIds() {
  const { data, error } = await supabase
    .from("business_cards")
    .select("matched_partner_id")
    .not("matched_partner_id", "is", null);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.matched_partner_id));
}

export async function findMatchedContactIds() {
  const { data, error } = await supabase
    .from("business_cards")
    .select("matched_contact_id")
    .not("matched_contact_id", "is", null);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.matched_contact_id));
}


export async function createBusinessCard(card: BCInsert) {
  const { error } = await supabase.from("business_cards").insert(card);
  if (error) throw error;
}

export async function updateBusinessCard(id: string, updates: BCUpdate) {
  const { error } = await supabase.from("business_cards").update(updates).eq("id", id);
  if (error) throw error;
}

export async function deleteBusinessCards(ids: string[]) {
  const { error } = await supabase.from("business_cards").delete().in("id", ids);
  if (error) throw error;
}

export async function countBusinessCards() {
  const { count, error } = await supabase.from("business_cards").select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

export function invalidateBusinessCards(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: businessCardKeys.all });
  qc.invalidateQueries({ queryKey: businessCardKeys.matches });
}

export async function getBusinessCardRawData(id: string): Promise<Record<string, unknown>> {
  const { data } = await supabase.from("business_cards").select("raw_data").eq("id", id).single();
  return (data?.raw_data as Record<string, unknown>) || {};
}

export interface BcaDetail {
  matched_partner_id: string | null;
  contact_name: string | null;
  event_name: string | null;
  met_at: string | null;
}

/** Business cards abbinate a un set di partner (per dettagli BCA nella lista aziende). */
export async function findBusinessCardsByPartnerIds(partnerIds: string[]): Promise<BcaDetail[]> {
  if (!partnerIds.length) return [];
  const { data } = await supabase
    .from("business_cards")
    .select("matched_partner_id, contact_name, event_name, met_at")
    .in("matched_partner_id", partnerIds);
  return (data ?? []) as BcaDetail[];
}

/** Business card di un utente per la vista rete (BusinessCardsViewV2). */
export async function findBusinessCardsForUser(userId: string, limit = 100) {
  const { data, error } = await supabase
    .from("business_cards")
    .select("id, company_name, contact_name, email, phone, match_status, match_confidence, lead_status, event_name, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/** Snapshot business card per il tab Deep Search di Email Forge. */
export async function findBusinessCardDeepSearchSnapshot(id: string) {
  const { data } = await supabase
    .from("business_cards")
    .select("id, raw_data, ocr_confidence")
    .eq("id", id)
    .maybeSingle();
  return data;
}
