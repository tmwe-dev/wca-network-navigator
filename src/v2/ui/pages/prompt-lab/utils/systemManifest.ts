/**
 * System Manifest Generator
 *
 * Provides comprehensive static descriptions of the WCA Network Navigator
 * architecture to the Prompt Lab agent. This includes edge functions, tools,
 * side effects, data models, and commercial doctrine.
 *
 * Pure functions (no async, no DB calls) - returns formatted text descriptions.
 */

/**
 * Builds a comprehensive system manifest describing the full WCA architecture.
 * Used by Prompt Lab agent to understand available functions, tools, and side effects.
 */
export function buildSystemManifest(): string {
  return `
╔════════════════════════════════════════════════════════════════════════════╗
║               WCA NETWORK NAVIGATOR - SYSTEM MANIFEST v2                   ║
║          Architecture Overview for Prompt Lab & AI Agents                   ║
╚════════════════════════════════════════════════════════════════════════════╝

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 1: EDGE FUNCTIONS (API Endpoints)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ai-assistant
  Main conversational AI (LUCA) handling all scopes: cockpit, contacts,
  outreach, strategic, command, extension. Context-aware responses with
  multi-turn conversation support.

unified-assistant
  Router/proxy that forwards requests to ai-assistant with automatic scope
  resolution and context passthrough.

generate-email
  Email generation via Email Forge: contextAssembler → emailContract →
  journalistSelector. Produces on-brand, contextual emails.

generate-outreach
  Multi-channel outreach generation (email, WhatsApp, LinkedIn, SMS) with
  channel-specific formatting and cadence compliance.

improve-email
  Email copywriting improvement. Enhances tone, clarity, persuasion while
  preserving brand voice and doctrine compliance.

classify-email-response
  Inbound email classification into 8 categories: positive_reply,
  meeting_request, info_request, referral, auto_reply, negative_reply,
  unsubscribe, other.

daily-briefing
  Daily operational summary generation. Aggregates metrics, pending actions,
  and performance analytics into actionable briefing.

agent-execute
  Autonomous agent loop with sequential tool execution (max 80 steps per run).
  Uses decision tree logic with approval gates.

decision-dashboard
  Decision Engine API: evaluate decisions, execute with audit trail, manage
  approval workflows, undo actions, check dashboard status.

email-oracle
  Email orchestration and routing. Manages queue, scheduling, delivery tracking,
  and bounce handling across channels.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 2: AVAILABLE TOOLS (Agent Capabilities)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PARTNER OPERATIONS
  search_partners           - Query partners by location, type, capability
  get_partner_detail       - Retrieve full partner profile with history
  get_country_overview     - Country-level metrics and partner distribution
  get_directory_status     - Directory synchronization and coverage status
  download_single_partner  - Export partner data to file
  update_partner           - Modify partner attributes (company info, contacts)
  bulk_update_partners     - Batch update multiple partners
  add_partner_note         - Add internal note to partner record
  evaluate_partner         - Score partner against qualification criteria
  deep_search_partner      - Multi-field partner search with fuzzy matching

CONTACT MANAGEMENT
  search_contacts          - Query CRM contacts by name, email, company
  get_contact_detail       - Retrieve contact profile with activity history
  search_prospects         - Find prospects matching criteria
  create_activity          - Log call, meeting, email, note, task
  list_activities          - Retrieve activities for partner/contact
  update_activity          - Modify activity record

JOB & GLOBAL DATA
  list_jobs                - Query available job positions
  get_global_summary       - System-wide metrics and performance KPIs
  check_blacklist          - Verify if partner/contact is blacklisted

REMINDERS & MEMORY
  list_reminders           - Get pending and completed reminders
  create_reminder          - Schedule follow-up action
  save_memory              - Store context in agent memory
  search_memory            - Retrieve stored context and patterns

LEAD MANAGEMENT
  update_lead_status       - Progress lead through state machine
  get_approval_dashboard   - View pending approvals from Decision Engine

OUTREACH & COMMUNICATION
  generate_outreach        - Create multi-channel outreach draft
  send_email               - Send email (bypasses draft, triggers side effects)
  queue_outreach           - Add to outreach_queue for scheduled dispatch
  schedule_campaign        - Define campaign with cadence and triggers
  get_outreach_stats       - Campaign performance and delivery metrics

KNOWLEDGE BASE
  read_kb                  - Retrieve KB entry by category/topic
  write_kb                 - Create/update KB entry (doctrine, procedures)
  list_kb_categories       - Browse available KB categories

AUTONOMOUS EXECUTION
  execute_decision         - Route decision through Decision Engine
  undo_ai_action           - Revert last AI-triggered action (with audit trail)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 3: SIDE EFFECTS MAP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

send_email
  ✓ Creates activity (type: email_sent, timestamp: now)
  ✓ Updates partner.last_contact_date
  ✓ May trigger lead_status change (if state machine permits)
  ✓ Logged to supervisor_audit_log
  ✓ Updates outreach_queue entry status → completed

generate_outreach
  ✓ No side effects (draft only, no DB modifications)

improve_email
  ✓ No side effects (transformation only)

update_lead_status
  ✓ Creates activity (type: status_change, old_state → new_state)
  ✓ May trigger holding_pattern if moving to "holding" state
  ✓ Logged to supervisor_audit_log

create_reminder
  ✓ Creates reminder record (pending)
  ✓ Appears in reminders list and agent agenda

add_partner_note
  ✓ Appends to partner.internal_notes
  ✓ Creates activity (type: note_added)

update_partner
  ✓ Updates partner record fields
  ✓ Creates activity (type: partner_update)
  ✓ May invalidate cached metrics

create_activity
  ✓ Creates activity record with timestamp
  ✓ Updates partner.last_contact_date (if contact activity)
  ✓ Indexed for search and analytics

queue_outreach
  ✓ Creates entry in outreach_queue (status: pending, scheduled_at: datetime)
  ✓ Scheduled for dispatch by email-oracle
  ✓ Cadence check performed at enqueue time

execute_decision
  ✓ Routes through Decision Engine approval workflow
  ✓ May auto-execute or queue for human approval (depends on autonomy_level)
  ✓ Creates ai_pending_actions entry if approval required
  ✓ Logged to supervisor_audit_log

undo_ai_action
  ✓ Reverts last action taken by AI system
  ✓ Restores previous state
  ✓ Logged to supervisor_audit_log with reason

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 4: DATA MODEL (Core Tables)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

partners (~12,000 records)
  WCA logistics partners with company info, contacts, qualification metrics,
  lead_state, last_contact_date, internal_notes, engagement_score, blacklist_flag.

imported_contacts
  CRM contacts imported from various sources (email, LinkedIn, manual).
  Linked to partners and activities. Track email_verified, phone_verified.

activities
  All tracked interactions: email_sent, call, meeting, note, task, status_change,
  partner_update, note_added. Timestamp, actor, partner_id, contact_id, metadata.

email_queue
  Pending emails awaiting dispatch. Status: pending → sent → bounced → failed.
  Retry logic, bounce handling, delivery tracking.

outreach_queue
  Pending multi-channel messages (email, WhatsApp, LinkedIn, SMS).
  Status: pending → dispatched → delivered → failed. Scheduled_at, cadence_check.

kb_entries
  Knowledge base entries organized by category: doctrine, procedures, rules,
  templates, commercial_rules. Version control and audit trail.

ai_pending_actions
  Actions awaiting human approval from Decision Engine. Status: pending →
  approved → executed → rejected → expired. Reason, approver, timestamp.

supervisor_audit_log
  Complete audit trail of all AI-triggered actions. Actor: ai_agent, action_type,
  entity_id, before/after state, timestamp, approver_id, notes.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 5: COMMERCIAL DOCTRINE SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LEAD STATE MACHINE (9 states)
  new → first_touch_sent → holding → engaged → qualified → negotiation →
  converted | archived | blacklisted

  Rules: Only one path forward. Holding pattern enforces min contact interval.
  Converted/archived/blacklisted are terminal states.

CADENCE RULES
  Minimum intervals between contacts per channel (configured in KB):
  Email: min 3 days between touches unless positive response
  WhatsApp: min 5 days between messages
  LinkedIn: min 7 days between connection/message attempts
  Enforced at queue_outreach time (returns cadence_violation if breached)

GATE SYSTEM (Contact Permission Model)
  Four sequential gates applied before any outreach:
  1. Blacklist check (reject if blacklisted)
  2. Cadence check (reject if interval too short)
  3. Doctrine check (reject if violates commercial rules)
  4. Approval check (route through Decision Engine if autonomy_level < threshold)

WHATSAPP RULE
  Solo dopo prima email positiva E con numero verificato
  (Only after positive first email response AND verified phone number)

HOLDING PATTERN
  When lead moves to "holding" state, automatic delay imposed (configurable,
  default: 14 days). Prevents contact during cooling-off period.

BLACKLIST LOGIC
  Partners/contacts added to blacklist: after explicit unsubscribe, after
  3 negative responses, after compliance flag. Cannot be removed by AI system
  (manual supervision required). Overrides all other gates.

═══════════════════════════════════════════════════════════════════════════════
End of System Manifest
═══════════════════════════════════════════════════════════════════════════════
`;
}

/**
 * Builds company profile from app_settings configuration.
 * Formats company metadata for agent context and UI display.
 *
 * Expected keys in settings:
 * - ai_company_name: Company name
 * - ai_company_alias: Short company alias
 * - ai_contact_name: Primary contact name
 * - ai_contact_role: Primary contact role/title
 * - ai_sector: Business sector/industry
 * - ai_tone: Brand tone (e.g., "professional", "friendly", "formal")
 * - ai_language: Primary language (e.g., "it", "en")
 * - ai_business_goals: Business objectives/targets
 * - ai_behavior_rules: Behavioral constraints and guidelines
 * - ai_style_instructions: Style guide and formatting rules
 */
export function buildCompanyProfile(settings: Record<string, string>): string {
  const companyName = settings.ai_company_name || "n/d";
  const companyAlias = settings.ai_company_alias || "n/d";
  const contactName = settings.ai_contact_name || "n/d";
  const contactRole = settings.ai_contact_role || "n/d";
  const sector = settings.ai_sector || "n/d";
  const tone = settings.ai_tone || "n/d";
  const language = settings.ai_language || "n/d";
  const businessGoals = settings.ai_business_goals || "n/d";
  const behaviorRules = settings.ai_behavior_rules || "n/d";
  const styleInstructions = settings.ai_style_instructions || "n/d";

  return `
╔════════════════════════════════════════════════════════════════════╗
║                      PROFILO AZIENDA                              ║
╚════════════════════════════════════════════════════════════════════╝

Nome: ${companyName}
Alias: ${companyAlias}
Referente: ${contactName} (${contactRole})
Settore: ${sector}
Tono: ${tone}
Lingua: ${language}

Obiettivi business:
${behaviorRules === "n/d" ? "  " : "  "}${businessGoals}

Regole comportamentali:
${behaviorRules === "n/d" ? "  " : "  "}${behaviorRules}

Istruzioni stile:
${styleInstructions === "n/d" ? "  " : "  "}${styleInstructions}
`;
}
