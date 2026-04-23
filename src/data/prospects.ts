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
  // TODO: Route through apply_lead_status_rpc when RPC supports "prospect" entity type
  // Currently RPC only guards "partners" and "imported_contacts"
  // For now, fetch current status, update, and insert audit trail for supervisory tracking

  // Fetch current status for audit trail
  let oldStatus: string | null = null;
  try {
    const { data } = await supabase.from("prospects").select("lead_status").eq("id", id).single();
    oldStatus = data?.lead_status ?? null;
  } catch {
    // If fetch fails, continue with null old status
  }

  const { error: updateError } = await supabase.from("prospects").update({ lead_status: status }).eq("id", id);
  if (updateError) throw updateError;

  // Create audit log entry for supervisor review
  try {
    await supabase.from("supervisor_audit_log").insert({
      entity_type: "prospect",
      entity_id: id,
      old_status: oldStatus,
      new_status: status,
      reason: "updateProspectLeadStatus",
      actor_type: "system",
    } as unknown as Record<string, unknown>);
  } catch (auditError) {
    // Log but don't fail the main operation
    console.warn("Failed to log prospect status change to audit trail:", auditError);
  }
}

export async function updateProspect(id: string, updates: Record<string, unknown>) {
  const { error } = await supabase.from("prospects").update(updates as never).eq("id", id);
  if (error) throw error;
}
