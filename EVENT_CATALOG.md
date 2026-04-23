# WCA Partner Connect - Domain Events Catalog

## Analysis Complete

This catalog documents ALL domain events (explicit and implicit) currently in the WCA Partner Connect codebase.
Generated for Event Catalog foundation for Process Manager migration.

---

## LEAD DOMAIN EVENTS

### 1. **LeadStatusChanged** (IMPLICIT → EXPLICIT)
- **Tables affected**: `partners`, `business_cards`, `imported_contacts`, `prospects`
- **Status values**: new, first_touch_sent, engaged, qualified, negotiation, converted, archived, blacklisted
- **Mutation points**:
  - `/supabase/migrations/20260419100854_0dc4c878-b79c-4abb-baaa-4011a26694f2.sql` (bulk migrations)
  - `/supabase/functions/_shared/leadStatusUpdater.ts` (post-send pipeline)
  - `/supabase/functions/_shared/leadStatusGuard.ts` (centralized guard)
  - Trigger: `trg_sync_partner_lead_to_bca` (partners.lead_status → business_cards.lead_status)
  - Trigger: `trg_sync_bca_lead_to_partner` (business_cards.lead_status → partners, escalation only)
- **Current mechanism**: Direct SQL UPDATE + Trigger cascades + Edge function control
- **Semantic type**: EVENT (state transition)
- **Domains**: Lead, CRM
- **Issues**: Multiple write paths (triggers + edge functions), hard to track source of change

### 2. **FirstTouchSent** (IMPLICIT EVENT)
- **Source**: `/supabase/functions/_shared/leadStatusUpdater.ts:31-44`
- **Trigger**: Post-send pipeline detects `lead_status = 'new'` → transition to `first_touch_sent`
- **Channel agnostic**: Works for email, WhatsApp, LinkedIn, SMS
- **Source types**: partners, imported_contacts, business_cards
- **Metadata**: channel, source, sequence_day
- **Mechanism**: Edge function writes to partner/contact table via applyLeadStatusChange()
- **Semantic type**: EVENT (auto-triggered state change)

### 3. **LeadQualified** (IMPLICIT → COMMAND/EVENT)
- **Source**: Domain handlers and agent tools
- **File**: `/supabase/functions/_shared/domainHandler.ts:161-184`
- **Trigger**: Operative request (quote_request, booking_request, rate_inquiry) from engaged lead
- **Target**: Creates `ai_pending_actions` with action_type = "suggest_qualification"
- **Mechanism**: Event → Pending Action (approval workflow)
- **Semantic type**: COMMAND (pending approval)

### 4. **ConversionSignalDetected** (IMPLICIT EVENT)
- **Source**: `/supabase/functions/_shared/domainHandler.ts:129-159`
- **Trigger**: Partner in negotiation/qualified stage sends operative request
- **Action**: Creates pending action "confirm_conversion"
- **Mechanism**: Edge function inserts to `ai_pending_actions`
- **Semantic type**: EVENT (detected signal) → leads to COMMAND (confirmation)

---

## EMAIL DOMAIN EVENTS

### 5. **EmailMessageSent** (EXPLICIT EVENT)
- **Source**: `/supabase/functions/send-email/index.ts`
- **Post-send pipeline**: `/supabase/functions/_shared/postSendPipeline.ts:69-150`
- **Records to**:
  - `activities` (activity_type = 'send_email')
  - `outreach_queue` (status = 'sent')
  - `supervisor_audit_log` (all sends logged)
- **Metadata**: subject, body, recipient, channel, sequence_day, agent_id
- **Mechanism**: Direct insert → triggers activity logging, lead status update, reminder creation
- **Semantic type**: EVENT

### 6. **InboundEmailReceived** (EXPLICIT EVENT)
- **Source**: `/supabase/functions/email-cron-sync/` or `/supabase/functions/email-imap-proxy/`
- **Table**: `channel_messages` INSERT
- **Trigger**: `trg_on_inbound_message` (20260419094956_484ab5de...)
- **Trigger function**: `/supabase/migrations/20260423100000_fix_inbound_trigger_no_spam_activities.sql`
  - Matches: in_reply_to, partner_id, from_address
  - Side effects:
    - Updates `outreach_queue` status to 'replied'
    - Creates `activities` with type = 'follow_up' (only if partner matched)
    - Updates `outreach_schedules` status to 'skipped' (pending followups)
- **Semantic type**: EVENT

### 7. **EmailClassified** (IMPLICIT EVENT)
- **Source**: `/supabase/functions/_shared/postClassificationPipeline.ts`
- **Inserts to**: `email_classifications`
- **Metadata**: category, confidence, urgency, sentiment, keywords, action_suggested
- **Triggers domain handlers**: operative, administrative, support, internal
- **Mechanism**: Classification → creates `ai_pending_actions`
- **Semantic type**: EVENT (classification) → COMMAND (action pending)

### 8. **EmailTemplateUpdated** (IMPLICIT EVENT)
- **Source**: Agent tools or admin UI
- **Table**: `email_templates` UPDATE
- **Trigger**: `update_email_templates_updated_at`
- **Semantic type**: EVENT (update timestamp)

---

## OUTREACH DOMAIN EVENTS

### 9. **OutreachQueueItemCreated** (EXPLICIT EVENT)
- **Source**: Multiple edge functions and agent tools
- **Files**: 
  - `/supabase/functions/cadence-engine/`
  - `/supabase/functions/agent-execute/toolHandlers/emailTools.ts:150-180`
- **Table**: `outreach_queue` INSERT
- **Payload**: channel, recipient_email, partner_id, subject, body, status='pending'
- **Semantic type**: COMMAND (scheduled action)

### 10. **OutreachQueueItemProcessed** (IMPLICIT EVENT)
- **Table**: `outreach_queue` UPDATE (status: pending → sent/failed/bounced)
- **Source**: Various processors (email-cron-sync, cadence-engine, pending-action-executor)
- **Mechanism**: UPDATE with processed_at timestamp, last_error tracking
- **Semantic type**: EVENT

### 11. **OutreachQueueItemReplied** (IMPLICIT EVENT)
- **Source**: Trigger function `on_inbound_message()`
- **Mechanism**: When inbound message matches sent outreach item
- **Update**: `outreach_queue.status = 'replied', replied_at = now(), reply_message_id = <message_id>`
- **Semantic type**: EVENT

### 12. **OutreachScheduleSkipped** (IMPLICIT EVENT)
- **Source**: Trigger `on_inbound_message()` (line 88-94)
- **Table**: `outreach_schedules` UPDATE
- **Trigger**: Reply received on pending followup schedule
- **Update**: status = 'skipped', last_error = 'reply received on <channel>'
- **Semantic type**: EVENT

---

## AI/AUTOMATION DOMAIN EVENTS

### 13. **AIPendingActionCreated** (EXPLICIT EVENT)
- **Source**: Multiple handlers (domain, question/complaint, enrichment)
- **Table**: `ai_pending_actions` INSERT
- **Status**: pending, approved, executed, rejected, failed
- **Trigger function**: `on_ai_pending_action_approved()` (20260416104125_8cd05795...)
  - When status changes to 'approved': calls `/functions/v1/pending-action-executor`
- **Semantic type**: COMMAND (pending approval → execution)
- **Examples**:
  - action_type = "draft_quote_response" (operative domain)
  - action_type = "confirm_conversion" (lead domain)
  - action_type = "suggest_qualification" (lead domain)
  - action_type = "upsell_opportunity" (lead domain)

### 14. **AIPendingActionApproved** (EXPLICIT EVENT)
- **Source**: `/supabase/functions/_shared/domainHandler.ts` and UI approval
- **Mechanism**: UPDATE `ai_pending_actions` SET status = 'approved'
- **Trigger**: Synchronous HTTP POST to `pending-action-executor` function
- **Semantic type**: EVENT → triggers execution

### 15. **AIMemoryCreated/Updated** (IMPLICIT EVENT)
- **Source**: `/supabase/functions/voice-brain-bridge/index.ts`
- **Table**: `ai_memory` INSERT/UPDATE
- **Metadata**: user_id, partner_id, memory_type, content, context
- **Semantic type**: EVENT (learning/memory persistence)

---

## ACTIVITY/AUDIT DOMAIN EVENTS

### 16. **ActivityLogged** (EXPLICIT EVENT)
- **Source**: `/supabase/functions/_shared/activityLogger.ts:9-49`
- **Table**: `activities` INSERT
- **Activity types**:
  - send_email, whatsapp_message, linkedin_message, sms_message (CHANNEL sends)
  - follow_up (inbound message responses)
  - question_received, complaint_received (domain handlers)
  - Various CRM operations
- **Metadata**: partner_id, source_id, source_type, activity_type, status, priority, completed_at
- **Mechanism**: Inserted by post-send pipeline for EVERY send
- **Semantic type**: EVENT (audit trail + action record)

### 17. **ContactInteractionLogged** (IMPLICIT EVENT)
- **Source**: `/supabase/functions/_shared/interactionLogger.ts`
- **Table**: `contact_interactions` INSERT
- **Trigger**: Every email send/receive
- **Tracked metrics**: increment_contact_interaction() RPC
- **Semantic type**: EVENT (interaction counting)

### 18. **PartnerInteractionIncremented** (IMPLICIT EVENT)
- **Source**: `/supabase/functions/_shared/postSendPipeline.ts:131-134`
- **Mechanism**: RPC call `increment_partner_interaction(partner_id)`
- **Semantic type**: EVENT (metric update)

### 19. **SupervisorAuditLogged** (EXPLICIT EVENT - NEW, LOVABLE-93)
- **Source**: `/supabase/functions/_shared/supervisorAudit.ts`
- **Table**: `supervisor_audit_log` INSERT
- **Logged for**: EVERY email send (mandatory)
- **Metadata**: user_id, partner_id, action, channel, source, decision_origin, actor_type, ai_confidence
- **Semantic type**: AUDIT EVENT

---

## REMINDER/FOLLOW-UP DOMAIN EVENTS

### 20. **ReminderCreated** (IMPLICIT EVENT)
- **Source**: `/supabase/functions/_shared/reminderManager.ts:create*`
- **Table**: `reminders` INSERT
- **Triggers**: Auto-created post-send with channel-specific delay
- **Mechanism**: Background scheduler
- **Semantic type**: EVENT (reminder scheduled)

### 21. **ReminderTriggered** (IMPLICIT EVENT)
- **Source**: Cron jobs or reminder scheduler
- **Mechanism**: Creates follow-up `activities`
- **Semantic type**: EVENT (reminder fired)

### 22. **NextActionEnsured** (IMPLICIT EVENT)
- **Source**: `/supabase/functions/_shared/reminderManager.ts:ensureNextAction()`
- **Mechanism**: Validates/creates next scheduled action in sequence
- **Semantic type**: COMMAND (next action scheduled)

---

## QUALITY/ENRICHMENT DOMAIN EVENTS

### 23. **PartnerQualityCalculated** (IMPLICIT EVENT)
- **Trigger functions**:
  - trigger_quality_on_certification_change
  - trigger_quality_on_contact_change
  - trigger_quality_on_enrichment_update
  - trigger_quality_on_membership_update
  - trigger_quality_on_network_change
  - trigger_quality_on_profile_update
  - trigger_quality_on_service_change
  - trigger_quality_on_sherlock_complete
- **Tables affected**: partners, partner_certifications, partner_contacts, etc.
- **Mechanism**: AFTER INSERT/UPDATE triggers call quality calculation RPC
- **Semantic type**: EVENT (quality score updated)

### 24. **EnrichmentRefreshRequested** (IMPLICIT EVENT)
- **Source**: `/supabase/functions/_shared/oracleRefresh.ts`
- **Mechanism**: Creates `ai_pending_actions` with action_type = "refresh_enrichment"
- **Trigger**: Post-send pipeline checks if enrichment data is stale
- **Semantic type**: COMMAND (pending execution)

---

## LEARNING/KNOWLEDGE DOMAIN EVENTS

### 25. **KBEntryAccessed** (IMPLICIT EVENT)
- **Mechanism**: `increment_kb_access()` RPC
- **Triggered by**: Knowledge base queries in agent context
- **Semantic type**: EVENT (metric)

### 26. **MemoryAccessed** (IMPLICIT EVENT)
- **Mechanism**: `increment_memory_access()` RPC
- **Semantic type**: EVENT (metric)

---

## VOICE DOMAIN EVENTS

### 27. **VoiceCallSessionCreated** (IMPLICIT EVENT)
- **Source**: `/supabase/functions/voice-brain-bridge/index.ts`
- **Table**: `voice_call_sessions` INSERT
- **Metadata**: session_id, user_id, partner_id, transcript, ai_summary
- **Semantic type**: EVENT

### 28. **VoiceCallTranscriptUpdated** (IMPLICIT EVENT)
- **Source**: `/supabase/functions/voice-brain-bridge/index.ts:~350-380`
- **Mechanism**: UPDATE `voice_call_sessions` SET transcript = ...
- **Semantic type**: EVENT

### 29. **VoiceCallSessionFinalized** (IMPLICIT EVENT)
- **Source**: Voice bridge function after conversation
- **Mechanism**: UPDATE `voice_call_sessions` with final summary, sentiment, memory
- **Semantic type**: EVENT

---

## SYNCHRONIZATION DOMAIN EVENTS

### 30. **PartnerLeadStatusSyncedToBusinessCard** (IMPLICIT EVENT)
- **Trigger**: `trg_sync_partner_lead_to_bca`
- **Source**: UPDATE partners SET lead_status
- **Effect**: Cascades to all matched business_cards
- **Mechanism**: Trigger function (20260405100515_ccd88fa0...)
- **Semantic type**: EVENT (sync event)

### 31. **BusinessCardLeadStatusEscalatedToPartner** (IMPLICIT EVENT)
- **Trigger**: `trg_sync_bca_lead_to_partner`
- **Source**: UPDATE business_cards SET lead_status
- **Effect**: Escalates to matched partner ONLY if new status > old status
- **Ordering**: new < contacted < in_progress < negotiation < converted
- **Mechanism**: Trigger function with escalation rules
- **Semantic type**: EVENT (escalation)

---

## CROSS-DOMAIN READS (BOUNDED CONTEXT VIOLATIONS)

### 32. **Voice Bridge → Partners/KB Cross-Domain Read**
- **Location**: `/supabase/functions/voice-brain-bridge/index.ts`
- **Reads**: partners, kb_entries, commercial_playbooks, app_settings
- **Issue**: Voice domain directly querying Lead/Learning domains
- **Semantic violation**: Should go through API/event-driven pattern

### 33. **Agent Execute → Multiple Domain Reads**
- **Location**: `/supabase/functions/agent-execute/`
- **Reads**: partners, activities, contacts, kb_entries, commercial_playbooks, operatives
- **Issue**: Agent is orchestrator accessing all domains
- **Semantic violation**: Coupled to multiple domain schemas

### 34. **Domain Handler → Partners Lead Status Read**
- **Location**: `/supabase/functions/_shared/domainHandler.ts:77-86`
- **Read pattern**: SELECT lead_status FROM partners
- **Purpose**: Determine signal type for pending actions
- **Semantic violation**: Reading lead state to trigger actions (should subscribe to LeadStatusChanged event)

---

## TABLES WITH IMPLICIT EVENTS (NOT EXPLICITLY PUBLISHED)

1. **partners** - All columns, especially:
   - lead_status (7+ write paths)
   - last_interaction_at
   - touch_count
   - profile_description
   - is_favorite

2. **business_cards** - lead_status synchronization

3. **channel_messages** - INSERT → triggers inbound processing

4. **outreach_queue** - Status transitions (pending → sent → replied)

5. **outreach_schedules** - Status transitions (pending → skipped/executed)

6. **activities** - INSERT events (implicit domain events)

7. **ai_pending_actions** - INSERT/UPDATE on status field

8. **reminders** - INSERT events

9. **ai_memory** - INSERT/UPDATE events

10. **voice_call_sessions** - INSERT/UPDATE events

11. **contact_interactions** - INSERT events (via RPC increment)

---

## SUMMARY STATISTICS

- **Total Explicit Events**: ~15
- **Total Implicit Events**: ~30
- **Total Trigger Functions**: 45+
- **Tables with Triggers**: 19
- **Cross-Domain Reads**: 3+ major (Voice, Agent, DomainHandler)
- **Lead Status Write Paths**: 7+
  1. Direct partner UPDATE (manual/UI)
  2. leadStatusUpdater.ts → post-send pipeline
  3. leadStatusGuard.ts → centralized guard
  4. trigger: sync_partner_lead_status_to_bca
  5. trigger: sync_bca_lead_status_to_partner (escalation)
  6. Direct imported_contacts UPDATE
  7. Direct business_cards UPDATE

---

## RECOMMENDED EVENT TAXONOMY FOR PROCESS MANAGER

### Lead Domain Commands
- `ChangeLeadStatus` → emits `LeadStatusChanged`
- `QualifyLead` → creates `LeadQualified`
- `ConvertLead` → emits `LeadConverted`

### Email Domain Commands
- `SendEmail` → emits `EmailSent`
- `ProcessInbound` → emits `InboundEmailReceived`
- `ClassifyEmail` → emits `EmailClassified`

### Outreach Domain Commands
- `ScheduleOutreach` → creates `OutreachScheduled`
- `ExecuteOutreach` → emits `OutreachExecuted`
- `TrackReply` → emits `OutreachReplied`

### AI/Automation Commands
- `CreatePendingAction` → emits `PendingActionCreated`
- `ApprovePendingAction` → emits `PendingActionApproved` + triggers execution
- `ExecuteAction` → emits `ActionExecuted`

### Activity/Audit Events (all read-only)
- `ActivityLogged`
- `InteractionRecorded`
- `AuditLogged`
