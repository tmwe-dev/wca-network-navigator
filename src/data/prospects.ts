/**
 * DAL — prospects
 */
import { supabase } from "@/integrations/supabase/client";


import { createLogger } from "@/lib/log";
const log = createLogger("prospects");
export async function queryProspects(builder: (q: unknown) => unknown) {
  const base = supabase.from("prospects").select("*").order("company_name");
  const { data, error } = await (builder(base) as never);
  if (error) throw error;
  return data ?? [];
}

export async function updateProspectLeadStatus(id: string, status: string) {
  // P3.7: apply_lead_status_rpc non esiste a DB. UPDATE diretto.
  const { error } = await supabase
    .from("prospects")
    .update({ lead_status: status as never })
    .eq("id", id);
  if (error) throw error;
}

export async function updateProspect(id: string, updates: Record<string, unknown>) {
  // GUARD: strip lead_status — must go through updateProspectLeadStatus() / RPC
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { lead_status: _stripped, ...safeUpdates } = updates;
  if (_stripped !== undefined) {
    log.warn("[updateProspect] lead_status stripped from generic update — use updateProspectLeadStatus() instead");
  }
  const { error } = await supabase.from("prospects").update(safeUpdates as never).eq("id", id);
  if (error) throw error;
}
