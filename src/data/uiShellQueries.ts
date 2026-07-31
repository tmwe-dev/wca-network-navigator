/**
 * DAL — query usate da shell UI, drawer globali, briefing e gate di invio.
 * Estratto 1:1 dai componenti: select, filtri, limiti e semantica errori invariati.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type ActivityUpdate = Database["public"]["Tables"]["activities"]["Update"];

export async function findPrototypeContacts(
  select: string,
  limit: number,
  orderByCreatedAtDesc: boolean,
): Promise<{ data: unknown[] | null; error: { message: string } | null }> {
  const base = supabase.from("partner_contacts").select(select);
  const query = orderByCreatedAtDesc
    ? base.order("created_at", { ascending: false }).limit(limit)
    : base.limit(limit);
  const { data, error } = await query;
  return { data, error };
}

export async function getAppSettingByKey(key: string): Promise<{ value: string | null } | null> {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return data;
}

export async function getUserAppSetting(
  key: string,
  userId: string,
): Promise<{ data: { value: string | null } | null; error: { message: string } | null }> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .eq("user_id", userId)
    .maybeSingle();
  return { data, error };
}

export async function upsertUserAppSetting(
  userId: string,
  key: string,
  value: string,
): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase
    .from("app_settings")
    .upsert({ user_id: userId, key, value }, { onConflict: "user_id,key" });
  return { error };
}

export async function updateActivityById(
  activityId: string,
  updates: ActivityUpdate,
): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase.from("activities").update(updates).eq("id", activityId);
  return { error };
}

export async function searchNetworkPartners(term: string): Promise<unknown[]> {
  const { data } = await supabase
    .from("partners")
    .select("id, company_name, company_alias, country_code, city, email, partner_contacts(id, name, email, contact_alias, title)")
    .or(`company_name.ilike.%${term}%,company_alias.ilike.%${term}%,email.ilike.%${term}%`)
    .eq("is_active", true)
    .limit(30);
  return data ?? [];
}

export async function findImportedContactsFacetPage(
  from: number,
  pageSize: number,
): Promise<{ data: { country: string | null; origin: string | null }[] | null; error: { message: string } | null }> {
  const { data, error } = await supabase
    .from("imported_contacts")
    .select("country, origin")
    .range(from, from + pageSize - 1);
  return { data, error };
}

export async function searchImportedContacts(term: string): Promise<unknown[]> {
  const { data } = await supabase
    .from("imported_contacts")
    .select("id, name, company_name, company_alias, country, email, position")
    .or(`name.ilike.%${term}%,company_name.ilike.%${term}%,company_alias.ilike.%${term}%,email.ilike.%${term}%`)
    .limit(30);
  return data ?? [];
}

export async function searchRecipientPartners(pattern: string): Promise<unknown[]> {
  const { data, error } = await supabase
    .from("partners")
    .select("id, company_name, country_name, city, email, enriched_at")
    .or(`company_name.ilike.${pattern},city.ilike.${pattern},country_name.ilike.${pattern}`)
    .order("company_name")
    .limit(20);
  if (error) throw error;
  return data ?? [];
}

export async function getPartnerSnapshot(partnerId: string): Promise<unknown> {
  const { data } = await supabase
    .from("partners")
    .select("company_name, company_alias, country_name, city, last_interaction_at, interaction_count, enrichment_data, lead_status")
    .eq("id", partnerId)
    .maybeSingle();
  return data;
}

export async function getConversationContextByEmail(email: string) {
  const { data } = await supabase
    .from("contact_conversation_context")
    .select("interaction_count, last_interaction_at, dominant_sentiment, response_rate, avg_response_time_hours")
    .eq("email_address", email)
    .maybeSingle();
  return data;
}

export async function getAddressRuleByEmail(email: string) {
  const { data } = await supabase
    .from("email_address_rules")
    .select("id, is_active, success_rate")
    .eq("email_address", email)
    .maybeSingle();
  return data;
}

export async function findActiveAgentNames(): Promise<{ id: string; name: string }[] | null> {
  const { data } = await supabase.from("agents").select("id, name").eq("is_active", true);
  return data;
}

export async function insertBriefingAgentTask(input: {
  agentId: string;
  userId: string;
  description: string;
}): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from("agent_tasks")
    .insert({
      agent_id: input.agentId,
      user_id: input.userId,
      task_type: "briefing_action",
      description: input.description,
      status: "pending",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data;
}
