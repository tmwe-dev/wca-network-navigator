/**
 * leadStatusGuard.ts — Single source of truth per le transizioni di lead_status.
 *
 * Tassonomia (9 stati canonici):
 *   new | first_touch_sent | holding | engaged | qualified | negotiation | converted | archived | blacklisted
 *
 * Regole:
 *  - Solo escalation monotona consentita (no downgrade).
 *  - archived/blacklisted sempre permessi (manuali, terminali) ma richiedono `reason`.
 *  - Stati sconosciuti → bloccati.
 *
 * Tutte le transizioni passano da `applyLeadStatusChange()` per garantire:
 *  - validazione + audit log automatico in supervisor_audit_log
 *  - status_reason settato/svuotato in modo coerente
 */

import { logSupervisorAudit } from "./supervisorAudit.ts";

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export const LEAD_STATUS_ORDER: Record<string, number> = {
  new: 0,
  first_touch_sent: 1,
  holding: 2,
  engaged: 3,
  qualified: 4,
  negotiation: 5,
  converted: 6,
};

export const TERMINAL_STATUSES = new Set(["archived", "blacklisted"]);
export const ALL_STATUSES = new Set([
  "new", "first_touch_sent", "holding", "engaged",
  "qualified", "negotiation", "converted", "archived", "blacklisted",
]);

export function isValidLeadTransition(from: string | null | undefined, to: string): boolean {
  if (!ALL_STATUSES.has(to)) return false;
  const current = (from || "new").toLowerCase();
  if (current === to) return false;
  // archived/blacklisted sempre consentiti da qualsiasi stato
  if (TERMINAL_STATUSES.has(to)) return true;
  // Riabilitazione da archived/blacklisted: vietata via guard (richiede operazione manuale documentata)
  if (TERMINAL_STATUSES.has(current)) return false;
  const oFrom = LEAD_STATUS_ORDER[current];
  const oTo = LEAD_STATUS_ORDER[to];
  if (oFrom === undefined || oTo === undefined) return false;
  return oTo > oFrom;
}

export interface ApplyLeadStatusInput {
  table: "partners" | "imported_contacts" | "business_cards";
  recordId: string;
  newStatus: string;
  userId: string;
  actor: {
    type: "user" | "ai_agent" | "system" | "cron";
    id?: string;
    name?: string;
  };
  decisionOrigin:
    | "manual" | "ai_auto" | "ai_approved" | "ai_rejected"
    | "ai_modified" | "system_cron" | "system_trigger";
  trigger: string;
  reason?: string;          // obbligatorio per archived/blacklisted
  partnerIdForAudit?: string;
  contactIdForAudit?: string;
  metadata?: Record<string, unknown>;
}

export interface ApplyLeadStatusResult {
  applied: boolean;
  previousStatus: string | null;
  newStatus: string;
  blockedReason?: string;
}

/**
 * Punto unico per applicare un cambio di lead_status.
 * - Carica lo stato corrente
 * - Valida la transizione
 * - Per archived/blacklisted richiede reason (no reason → blocco)
 * - Esegue UPDATE includendo status_reason
 * - Logga in supervisor_audit_log (fire-and-forget)
 */
export async function applyLeadStatusChange(
  supabase: SupabaseClient,
  input: ApplyLeadStatusInput,
): Promise<ApplyLeadStatusResult> {
  const { table, recordId, newStatus } = input;

  // 1) Stato corrente
  const { data: current, error: fetchErr } = await supabase
    .from(table)
    .select("lead_status")
    .eq("id", recordId)
    .maybeSingle();

  if (fetchErr || !current) {
    return {
      applied: false, previousStatus: null, newStatus,
      blockedReason: `Record non trovato in ${table} (${recordId})`,
    };
  }

  const previousStatus = (current as { lead_status: string | null }).lead_status ?? "new";

  // 2) Validazione
  if (!isValidLeadTransition(previousStatus, newStatus)) {
    console.warn("[leadStatusGuard] BLOCKED transition", JSON.stringify({
      table, recordId, from: previousStatus, to: newStatus, actor: input.actor.name,
    }));
    return {
      applied: false, previousStatus, newStatus,
      blockedReason: `Transizione non valida: ${previousStatus} → ${newStatus}`,
    };
  }

  // 3) Reason obbligatoria per terminali
  if (TERMINAL_STATUSES.has(newStatus) && !input.reason?.trim()) {
    console.warn("[leadStatusGuard] BLOCKED terminal without reason", JSON.stringify({
      table, recordId, to: newStatus,
    }));
    return {
      applied: false, previousStatus, newStatus,
      blockedReason: `Per "${newStatus}" la ragione è obbligatoria`,
    };
  }

  // 4) UPDATE
  const updates: Record<string, unknown> = { lead_status: newStatus };
  if (TERMINAL_STATUSES.has(newStatus)) {
    updates.status_reason = input.reason!.trim();
  }
  if (table === "partners") {
    updates.last_interaction_at = new Date().toISOString();
  }

  const { error: updErr } = await supabase
    .from(table)
    .update(updates)
    .eq("id", recordId);

  if (updErr) {
    return {
      applied: false, previousStatus, newStatus,
      blockedReason: `DB error: ${updErr.message}`,
    };
  }

  // 5) Audit log (fire-and-forget)
  logSupervisorAudit(supabase, {
    user_id: input.userId,
    actor_type: input.actor.type,
    actor_id: input.actor.id,
    actor_name: input.actor.name ?? input.actor.type,
    action_category: "lead_status_change",
    action_detail: `${previousStatus} → ${newStatus} (${input.trigger})`,
    target_type: table === "partners" ? "partner" : "imported_contact",
    target_id: recordId,
    partner_id: input.partnerIdForAudit ?? (table === "partners" ? recordId : undefined),
    contact_id: input.contactIdForAudit ?? (table === "imported_contacts" ? recordId : undefined),
    decision_origin: input.decisionOrigin,
    metadata: {
      previous_status: previousStatus,
      new_status: newStatus,
      trigger: input.trigger,
      reason: input.reason ?? null,
      ...input.metadata,
    },
  });

  return { applied: true, previousStatus, newStatus };
}
