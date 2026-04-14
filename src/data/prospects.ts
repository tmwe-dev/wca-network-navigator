/**
 * DAL — prospects
 */
import { supabase } from "@/integrations/supabase/client";

export async function findProspects(select = "*", orderBy = "company_name") {
  const { data, error } = await supabase.from("prospects").select(select).order(orderBy);
  if (error) throw error;
  return data ?? [];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase dynamic query builder returns untyped result
export async function queryProspects(builder: (q: unknown) => unknown) {
  const base = supabase.from("prospects").select("*").order("company_name");
  const { data, error } = await (builder(base) as unknown);
  if (error) throw error;
  return data ?? [];
}

export async function updateProspectLeadStatus(id: string, status: string) {
  const { error } = await supabase.from("prospects").update({ lead_status: status }).eq("id", id);
  if (error) throw error;
}

export async function getProspectWithContacts(id: string) {
  const { data, error } = await supabase.from("prospects").select("*, prospect_contacts(*)").eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function updateProspect(id: string, updates: Record<string, unknown>) {
  const { error } = await supabase.from("prospects").update(updates).eq("id", id);
  if (error) throw error;
}
