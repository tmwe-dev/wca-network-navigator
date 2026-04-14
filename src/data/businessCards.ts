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
    .select("*, partner:matched_partner_id(id, company_name, logo_url, company_alias, enrichment_data, country_code, lead_status)")
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

export async function getBusinessCardFilterOptions() {
  const { data, error } = await supabase
    .from("business_cards")
    .select("event_name, match_status");
  if (error) throw error;
  return data ?? [];
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
