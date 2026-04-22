/**
 * DAL — prospects
 */
import { supabase } from "@/integrations/supabase/client";

export async function queryProspects(builder: (q: unknown) => unknown) {
  const base = supabase.from("prospects").select("*").order("company_name");
  const { data, error } = await (builder(base) as never);
  if (error) throw error;
  return data ?? [];
}

export async function updateProspectLeadStatus(id: string, status: string) {
  const { error } = await supabase.from("prospects").update({ lead_status: status }).eq("id", id);
  if (error) throw error;
}

export async function updateProspect(id: string, updates: Record<string, unknown>) {
  const { error } = await supabase.from("prospects").update(updates as never).eq("id", id);
  if (error) throw error;
}
