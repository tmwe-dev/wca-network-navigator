/**
 * DAL — supervisor_audit_log
 */
import { supabase } from "@/integrations/supabase/client";


import { createLogger } from "@/lib/log";
const log = createLogger("supervisorAuditLog");
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
  // Schema reale: action_category + action_detail (non `action`).
  // Manteniamo l'API esterna stabile e mappiamo internamente.
  const [category, ...rest] = (entry.action ?? "").split(":");
  const detail = rest.length > 0 ? rest.join(":") : entry.action;
  const { error } = await supabase.from("supervisor_audit_log").insert({
    actor_type: entry.actor_type ?? "user",
    actor_id: entry.actor_id ?? null,
    actor_name: entry.actor_name ?? null,
    action_category: category || "general",
    action_detail: detail || entry.action,
    target_type: entry.target_table ?? null,
    target_id: entry.target_id ?? null,
    metadata: entry.payload ?? {},
  } as never);
  if (error) {
    // Audit failure must not block UX
    log.warn("[supervisor_audit_log] insert failed", { error: error });
  }
}