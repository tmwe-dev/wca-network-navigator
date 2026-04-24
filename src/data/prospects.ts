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
  // Route through apply_lead_status_rpc — supports prospects since migration 20260424120000
  const { data, error } = await supabase.rpc("apply_lead_status_rpc", {
    p_table: "prospects",
    p_record_id: id,
    p_new_status: status,
  });

  if (error) throw error;

  const result = data as { applied: boolean; blocked_reason?: string } | null;
  if (result && !result.applied) {
    throw new Error(result.blocked_reason || "Transizione non consentita");
  }
}

export async function updateProspect(id: string, updates: Record<string, unknown>) {
  // GUARD: strip lead_status — must go through updateProspectLeadStatus() / RPC
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { lead_status: _stripped, ...safeUpdates } = updates;
  if (_stripped !== undefined) {
    console.warn("[updateProspect] lead_status stripped from generic update — use updateProspectLeadStatus() instead");
  }
  const { error } = await supabase.from("prospects").update(safeUpdates as never).eq("id", id);
  if (error) throw error;
}
