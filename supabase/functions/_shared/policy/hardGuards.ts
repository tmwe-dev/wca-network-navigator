/**
 * LIVELLO 0 — Policy Hard (edge twin)
 *
 * Guardrail server-side. Identico al client per coerenza.
 * Validazione sempre eseguita anche se l'AI ignora il prompt.
 */

export class HardGuardError extends Error {
  readonly code: string;
  readonly details?: Record<string, unknown>;
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "HardGuardError";
    this.code = code;
    this.details = details;
  }
}

const FORBIDDEN_TABLES = new Set<string>([
  "auth.users",
  "auth.sessions",
  "user_roles",
  "authorized_users",
  "vault.secrets",
  "supabase_functions",
  "storage.objects",
]);

const AI_WRITABLE_TABLES = new Set<string>([
  "activities",
  "ai_conversations",
  "ai_daily_plans",
  "ai_memory",
  "ai_pending_actions",
  "ai_work_plans",
  "agent_tasks",
  "channel_messages",
  "email_drafts",
  "imported_contacts",
  "kb_entries",
  "mission_actions",
  "outreach_queue",
  "outreach_schedules",
  "partners",
  "partner_contacts",
]);

const APPROVAL_REQUIRED_TOOLS = new Set<string>([
  "send_email",
  "send_whatsapp",
  "send_linkedin",
  "execute_bulk_outreach",
  "schedule_campaign",
  "update_partner_status_bulk",
  "update_contact_status_bulk",
]);

export const DEFAULT_BULK_CAP = 5;
export const MAX_BULK_CAP_HARD = 100;

export function assertNotDestructive(action: string): void {
  const a = action.trim().toLowerCase();
  if (a.startsWith("delete") || a.startsWith("drop") || a.startsWith("truncate")) {
    throw new HardGuardError(
      "DESTRUCTIVE_ACTION_FORBIDDEN",
      `Azione distruttiva vietata: "${action}".`,
      { action },
    );
  }
}

export function assertBulkCap(count: number, max: number = DEFAULT_BULK_CAP): void {
  if (count > MAX_BULK_CAP_HARD) {
    throw new HardGuardError(
      "BULK_CAP_HARD_EXCEEDED",
      `Bulk size ${count} supera limite assoluto ${MAX_BULK_CAP_HARD}.`,
      { count, hardMax: MAX_BULK_CAP_HARD },
    );
  }
  if (count > max) {
    throw new HardGuardError(
      "BULK_CAP_EXCEEDED",
      `Bulk ${count} richiede approvazione (max auto: ${max}).`,
      { count, max },
    );
  }
}

export function assertWhitelistedTable(tableName: string): void {
  const t = tableName.toLowerCase();
  if (FORBIDDEN_TABLES.has(t)) {
    throw new HardGuardError("TABLE_FORBIDDEN", `Tabella "${tableName}" vietata.`, { table: tableName });
  }
  if (!AI_WRITABLE_TABLES.has(t)) {
    throw new HardGuardError(
      "TABLE_NOT_WHITELISTED",
      `Tabella "${tableName}" non in whitelist AI.`,
      { table: tableName },
    );
  }
}

export function assertNotAuthTable(tableName: string): void {
  const t = tableName.toLowerCase();
  if (t.startsWith("auth.") || t === "user_roles" || t === "authorized_users") {
    throw new HardGuardError("AUTH_TABLE_FORBIDDEN", `Tabella auth "${tableName}" intoccabile.`, { table: tableName });
  }
}

export function requiresApproval(toolId: string): boolean {
  return APPROVAL_REQUIRED_TOOLS.has(toolId);
}

export interface PreflightArgs {
  toolId: string;
  action?: string;
  table?: string;
  bulkCount?: number;
  bulkMax?: number;
}

export interface PreflightResult {
  ok: boolean;
  needsApproval: boolean;
  error?: HardGuardError;
}

export function preflight(args: PreflightArgs): PreflightResult {
  try {
    if (args.action) assertNotDestructive(args.action);
    if (args.table) {
      assertNotAuthTable(args.table);
      assertWhitelistedTable(args.table);
    }
    if (typeof args.bulkCount === "number") {
      assertBulkCap(args.bulkCount, args.bulkMax ?? DEFAULT_BULK_CAP);
    }
    return { ok: true, needsApproval: requiresApproval(args.toolId) };
  } catch (e) {
    if (e instanceof HardGuardError) return { ok: false, needsApproval: false, error: e };
    throw e;
  }
}
