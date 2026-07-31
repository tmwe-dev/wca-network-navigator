/**
 * DAL — Queries for useApproveAndDispatch.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AiPendingActionsRow = Database["public"]["Tables"]["ai_pending_actions"]["Row"];

export async function getPendingActionById(id: string): Promise<{ data: AiPendingActionsRow | null; error: { message: string } | null }> {
  const { data, error } = await supabase.from("ai_pending_actions").select("*").eq("id", id).maybeSingle();
  return { data: data as AiPendingActionsRow | null, error };
}

export async function markPendingActionStatus(
  id: string,
  status: "executed" | "failed",
  lastError: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("ai_pending_actions")
    .update({
      status,
      executed_at: new Date().toISOString(),
      last_error: lastError,
    } as never)
    .eq("id", id);
  if (error) throw error;
}

export async function insertSupervisorAuditLog(entry: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from("supervisor_audit_log").insert(entry as never);
  if (error) throw error;
}
