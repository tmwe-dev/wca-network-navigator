/**
 * DAL — prospects
 */
import { supabase } from "@/integrations/supabase/client";

export async function findProspects(select = "*", orderBy = "company_name") {
  const { data, error } = await supabase.from("prospects" as any).select(select).order(orderBy);
  if (error) throw error;
  return data ?? [];
}

export async function queryProspects(builder: (q: any) => any) {
  const base = supabase.from("prospects" as any).select("*").order("company_name");
  const { data, error } = await builder(base);
  if (error) throw error;
  return data ?? [];
}

export async function updateProspectLeadStatus(id: string, status: string) {
  const { error } = await supabase.from("prospects" as any).update({ lead_status: status }).eq("id", id);
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
