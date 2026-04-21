/**
 * DAL — supervisor_audit_log
 */
import { supabase } from "@/integrations/supabase/client";

export interface AuditLogEntry {
  actor_type?: string;
  actor_id?: string;
  actor_name?: string;
  action: string;
  target_table?: string;
  target_id?: string;
  payload?: Record<string, unknown>;
}

export async function logSupervisorAudit(entry: AuditLogEntry): Promise<void> {
  const { error } = await supabase.from("supervisor_audit_log").insert({
    actor_type: entry.actor_type ?? "user",
    actor_id: entry.actor_id ?? null,
    actor_name: entry.actor_name ?? null,
    action: entry.action,
    target_table: entry.target_table ?? null,
    target_id: entry.target_id ?? null,
    payload: entry.payload ?? {},
  } as never);
  if (error) {
    // Audit failure must not block UX
    console.warn("[supervisor_audit_log] insert failed", error);
  }
}