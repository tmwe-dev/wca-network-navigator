/**
 * boundedContexts.ts — Domain ownership map + enforcement rules.
 *
 * Defines which tables belong to which domain. Used by:
 *   1. Runtime guards (optional) — log warnings when cross-domain reads happen
 *   2. CI/Code review checks — identify violations in PRs
 *   3. Documentation — clear ownership for every table
 *
 * REGOLA: Un dominio può LEGGERE le proprie tabelle e SCRIVERE solo tramite
 * il proprio Process Manager. Per leggere dati di un altro dominio, usa
 * un read model (vista materializzata) o chiedi tramite DomainEvent.
 */

// ═══════════════════════════════════════════════════════════
//  DOMAIN OWNERSHIP MAP
// ═══════════════════════════════════════════════════════════

export type DomainName =
  | "lead"
  | "email"
  | "outreach"
  | "ai_automation"
  | "enrichment"
  | "learning"
  | "voice"
  | "crm"
  | "audit"
  | "system";

export interface TableOwnership {
  table: string;
  domain: DomainName;
  /** Tables that this table syncs with (triggers) */
  syncsWith?: string[];
  /** Who is allowed to write */
  writeAuthority: string;
  notes?: string;
}

export const TABLE_OWNERSHIP: TableOwnership[] = [
  // ── LEAD DOMAIN ──
  { table: "partners", domain: "lead", writeAuthority: "LeadProcessManager", syncsWith: ["business_cards"], notes: "lead_status owned by LeadPM" },
  { table: "business_cards", domain: "lead", writeAuthority: "LeadProcessManager", syncsWith: ["partners"], notes: "Sync via triggers" },
  { table: "imported_contacts", domain: "lead", writeAuthority: "LeadProcessManager", notes: "Legacy, migrating to partners" },
  { table: "partner_contacts", domain: "lead", writeAuthority: "CRM/UI", notes: "Contact details" },

  // ── EMAIL DOMAIN ──
  { table: "channel_messages", domain: "email", writeAuthority: "EmailProcessManager", notes: "Inbound/outbound messages" },
  { table: "email_classifications", domain: "email", writeAuthority: "classify-inbound-message", notes: "AI classification results" },
  { table: "email_address_rules", domain: "email", writeAuthority: "check-inbox/postClassification", notes: "Per-address rules" },
  { table: "email_templates", domain: "email", writeAuthority: "UI/admin", notes: "Email templates" },

  // ── OUTREACH DOMAIN ──
  { table: "outreach_queue", domain: "outreach", writeAuthority: "OutreachProcessManager", notes: "Send queue" },
  { table: "outreach_schedules", domain: "outreach", writeAuthority: "cadence-engine", notes: "Scheduled touchpoints" },
  { table: "outreach_missions", domain: "outreach", writeAuthority: "UI/mission-executor", notes: "Multi-step campaigns" },
  { table: "mission_actions", domain: "outreach", writeAuthority: "mission-executor", notes: "Individual campaign steps" },

  // ── AI/AUTOMATION DOMAIN ──
  { table: "ai_pending_actions", domain: "ai_automation", writeAuthority: "multiple (see dedup_key)", notes: "Approval queue" },
  { table: "agent_tasks", domain: "ai_automation", writeAuthority: "agent-execute", notes: "Agent task queue" },
  { table: "agent_personas", domain: "ai_automation", writeAuthority: "UI/admin", notes: "Agent definitions" },
  { table: "ai_memory", domain: "ai_automation", writeAuthority: "voice-brain-bridge/agents", notes: "Agent memory" },

  // ── ENRICHMENT DOMAIN ──
  { table: "partner_deep_search_results", domain: "enrichment", writeAuthority: "deep-search/sherlock", notes: "Search results" },
  { table: "partner_certifications", domain: "enrichment", writeAuthority: "enrichment pipeline", notes: "Certs" },
  { table: "partner_network_memberships", domain: "enrichment", writeAuthority: "enrichment pipeline", notes: "Memberships" },
  { table: "partner_services", domain: "enrichment", writeAuthority: "enrichment pipeline", notes: "Services" },

  // ── LEARNING DOMAIN ──
  { table: "kb_entries", domain: "learning", writeAuthority: "UI/admin/architect", notes: "Knowledge base" },
  { table: "suggested_improvements", domain: "learning", writeAuthority: "LearningProcessManager", notes: "Improvement loop" },
  { table: "operative_prompts", domain: "learning", writeAuthority: "UI/admin", notes: "Operative prompts" },
  { table: "prompt_blocks", domain: "learning", writeAuthority: "UI/admin", notes: "Prompt components" },

  // ── VOICE DOMAIN ──
  { table: "voice_call_sessions", domain: "voice", writeAuthority: "voice-brain-bridge", notes: "Call sessions" },

  // ── AUDIT DOMAIN (read-only from other domains) ──
  { table: "activities", domain: "audit", writeAuthority: "multiple (activityLogger)", notes: "Activity log — append-only" },
  { table: "supervisor_audit_log", domain: "audit", writeAuthority: "supervisorAudit", notes: "Audit trail — append-only" },
  { table: "domain_events", domain: "audit", writeAuthority: "EventBus (publishAndPersist)", notes: "Event store — append-only" },
  { table: "contact_interactions", domain: "audit", writeAuthority: "interactionLogger", notes: "Interaction counts" },

  // ── SYSTEM DOMAIN ──
  { table: "app_settings", domain: "system", writeAuthority: "UI/admin", notes: "Global config" },
  { table: "user_credits", domain: "system", writeAuthority: "deduct_credits RPC", notes: "Credit system" },
];

// ═══════════════════════════════════════════════════════════
//  LOOKUP HELPERS
// ═══════════════════════════════════════════════════════════

const ownershipMap = new Map<string, TableOwnership>();
TABLE_OWNERSHIP.forEach(t => ownershipMap.set(t.table, t));

export function getTableDomain(table: string): DomainName | "unknown" {
  return ownershipMap.get(table)?.domain || "unknown";
}

export function getTableAuthority(table: string): string {
  return ownershipMap.get(table)?.writeAuthority || "unknown";
}

export function isOwnedBy(table: string, domain: DomainName): boolean {
  return getTableDomain(table) === domain;
}

// ═══════════════════════════════════════════════════════════
//  CROSS-DOMAIN READ ALLOWLIST
// ═══════════════════════════════════════════════════════════

/**
 * Allowed cross-domain reads. Everything else should go through
 * read models or events.
 *
 * Format: "reader_domain:table" → reason
 */
export const ALLOWED_CROSS_READS: Record<string, string> = {
  // Email domain needs partner info for context
  "email:partners": "Email context assembly needs company_name, country, lead_status",
  "email:partner_contacts": "Email needs contact name, email, title",
  "email:kb_entries": "Email generation uses KB for prompting",
  // Outreach needs partner + contact info
  "outreach:partners": "Outreach scheduling needs partner state",
  "outreach:partner_contacts": "Outreach needs contact details",
  // AI needs broad read access for context
  "ai_automation:partners": "Agent tools need partner context",
  "ai_automation:partner_contacts": "Agent tools need contact details",
  "ai_automation:kb_entries": "Agents use KB for responses",
  "ai_automation:activities": "Agents read history for context",
  // Voice needs partner context
  "voice:partners": "Voice bridge needs partner name/context",
  "voice:kb_entries": "Voice uses KB for real-time responses",
  // Enrichment reads partner for scoring
  "enrichment:partners": "Quality score needs partner profile data",
};

/**
 * Check if a cross-domain read is allowed.
 * Returns the reason if allowed, null if violation.
 */
export function checkCrossDomainRead(
  readerDomain: DomainName,
  table: string,
): { allowed: boolean; reason?: string } {
  const tableDomain = getTableDomain(table);
  if (tableDomain === readerDomain || tableDomain === "audit" || tableDomain === "system") {
    return { allowed: true, reason: "Same domain or shared domain" };
  }
  const key = `${readerDomain}:${table}`;
  const reason = ALLOWED_CROSS_READS[key];
  if (reason) {
    return { allowed: true, reason };
  }
  return { allowed: false };
}

/**
 * Runtime guard — logs warning for unauthorized cross-domain reads.
 * Non-blocking: logs but doesn't throw. Use in development/staging.
 */
export function guardCrossDomainRead(
  readerDomain: DomainName,
  table: string,
  caller: string,
): void {
  const check = checkCrossDomainRead(readerDomain, table);
  if (!check.allowed) {
    console.warn(
      `[BoundedContext] VIOLATION: ${caller} (domain: ${readerDomain}) reads "${table}" ` +
      `(domain: ${getTableDomain(table)}). Add to ALLOWED_CROSS_READS or use a read model.`
    );
  }
}
