/**
 * supervisorAudit.ts — Fire-and-forget audit logging for the Supervisor system.
 * Never blocks main flows; errors are swallowed with console.error.
 */

export interface AuditEntry {
  user_id: string;
  actor_type: "user" | "ai_agent" | "system" | "cron";
  actor_id?: string;
  actor_name?: string;
  action_category: string;
  action_detail: string;
  target_type?: string;
  target_id?: string;
  target_label?: string;
  partner_id?: string;
  contact_id?: string;
  email_address?: string;
  decision_origin: "manual" | "ai_auto" | "ai_approved" | "ai_rejected" | "ai_modified" | "system_cron" | "system_trigger";
  ai_decision_log_id?: string;
  metadata?: Record<string, unknown>;
}

export async function logSupervisorAudit(
  supabase: { from: (table: string) => { insert: (data: Record<string, unknown>) => Promise<unknown> } },
  entry: AuditEntry,
): Promise<void> {
  try {
    await supabase.from("supervisor_audit_log").insert({
      ...entry,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[SUPERVISOR] Audit log failed:", err);
  }
}

export async function logBatchAudit(
  supabase: { from: (table: string) => { insert: (data: Record<string, unknown>[]) => Promise<unknown> } },
  entries: AuditEntry[],
): Promise<void> {
  try {
    await supabase.from("supervisor_audit_log").insert(
      entries.map((e) => ({ ...e, created_at: new Date().toISOString() })),
    );
  } catch (err) {
    console.error("[SUPERVISOR] Batch audit log failed:", err);
  }
}
