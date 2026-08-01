# Edge Functions Catalog — WCA Network Navigator

> 148 Deno-based Edge Functions + shared modules in `_shared/`.
> Last updated: 2026-05-13 (Sprint K)

## Standard Structure

Every Edge Function follows this pattern:

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { getSecurityHeaders } from "../_shared/securityHeaders.ts";
import { requireAuth, isAuthError } from "../_shared/authGuard.ts";
import { startMetrics, endMetrics, logEdgeError } from "../_shared/monitoring.ts";

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const corsH = getCorsHeaders(origin);
  const headers = getSecurityHeaders(corsH);
  const metrics = startMetrics("function-name");

  try {
    const auth = await requireAuth(req, corsH);
    if (isAuthError(auth)) return auth;
    metrics.userId = auth.userId;

    // Business logic ...

    endMetrics(metrics, true, 200);
    return new Response(JSON.stringify({ success: true }), { status: 200, headers });
  } catch (error: unknown) {
    logEdgeError("function-name", error);
    endMetrics(metrics, false, 500);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers });
  }
});
```

## Shared Modules (`_shared/`)

| Module                         | Purpose                                                    |
| ------------------------------ | ---------------------------------------------------------- |
| `cors.ts`                      | Dynamic CORS headers with origin whitelist                 |
| `authGuard.ts`                 | JWT validation via getClaims                               |
| `cronGate.ts` / `cronGuard.ts` | Cron-secret verification for scheduled functions           |
| `monitoring.ts`                | Structured JSON logging with metrics                       |
| `structuredLogger.ts`          | Advanced structured logging                                |
| `securityHeaders.ts`           | Defense-in-depth HTTP headers (HSTS, CSP, X-Frame-Options) |
| `rateLimiter.ts`               | Token bucket rate limiting per user                        |
| `inputValidator.ts`            | Input sanitization utilities                               |
| `injectionGuard.ts`            | Prompt injection detection and blocking                    |
| `handleEdgeError.ts`           | Typed error responses with `edgeError()`                   |
| `csrfProtection.ts`            | Origin validation                                          |
| `htmlSanitizer.ts`             | DOMPurify-based HTML sanitization                          |
| `aiGateway.ts`                 | AI provider invocation gateway                             |
| `aiGatewayConfig.ts`           | Provider routing configuration (7 providers)               |
| `callLLM.ts`                   | Low-level LLM call wrapper                                 |
| `embeddings.ts`                | pgvector embedding generation                              |
| `supabaseClient.ts`            | Shared Supabase client factory                             |
| `discordAlert.ts`              | Discord webhook alerting                                   |
| `domainEvents.ts`              | Domain event bus                                           |
| `platformTools.ts`             | AI agent tool definitions                                  |
| `platformToolHandlers.ts`      | AI agent tool execution handlers                           |

## Complete Function Catalog

### AI Agents & Orchestration

| Function                  | Purpose                                         | Auth        | Rate Limited |
| ------------------------- | ----------------------------------------------- | ----------- | ------------ |
| `agent-audit`             | Audit trail for agent actions                   | JWT         | No           |
| `agent-autonomous-cycle`  | Autonomous agent execution cycle                | cron-secret | No           |
| `agent-autopilot-worker`  | Background worker for autopilot tasks           | cron-secret | No           |
| `agent-execute`           | Execute a single agent action with tools        | JWT         | Yes          |
| `agent-loop`              | Multi-turn agent conversation loop              | JWT         | Yes          |
| `agent-prompt-refiner`    | Weekly AI-driven prompt improvement suggestions | cron-secret | No           |
| `agent-simulate`          | Simulate agent behavior for testing             | JWT         | No           |
| `agent-task-drainer`      | Drain pending agent tasks from queue            | cron-secret | No           |
| `agentic-decide`          | AI decision-making for autonomous actions       | JWT         | No           |
| `ai-assistant`            | General-purpose AI assistant                    | JWT         | Yes          |
| `ai-backup`               | Backup AI interaction logs                      | JWT         | No           |
| `ai-deep-search-helper`   | Deep semantic search across knowledge base      | JWT         | No           |
| `ai-gateway-micro`        | Lightweight AI gateway for quick calls          | JWT         | No           |
| `ai-match-business-cards` | AI-powered business card to partner matching    | JWT         | No           |
| `ai-monitor`              | Monitor AI system health and usage              | JWT         | No           |
| `ai-query-planner`        | AI-powered SQL query planning                   | JWT         | No           |
| `ai-test-runner`          | Daily test suite execution for prompts          | JWT         | No           |
| `ai-tracking-healthcheck` | Health check for AI tracking systems            | JWT         | No           |
| `ai-utility`              | General AI utility operations                   | JWT         | No           |
| `ai-arena-suggest`        | A/B test arena for prompt comparison            | JWT         | No           |
| `command-ask-brain`       | Natural language command interface              | JWT         | No           |
| `daily-briefing`          | Generate daily AI briefing for user             | JWT         | No           |
| `decision-dashboard`      | AI decision analytics dashboard data            | JWT         | No           |
| `pending-action-executor` | Execute approved pending AI actions             | JWT         | No           |
| `unified-assistant`       | Unified conversational AI assistant             | JWT         | No           |

### Email Pipeline

| Function                   | Purpose                                             | Auth        | Rate Limited |
| -------------------------- | --------------------------------------------------- | ----------- | ------------ |
| `analyze-email-edit`       | AI analysis of email draft edits                    | JWT         | No           |
| `apply-email-rules`        | Apply sender-level email routing rules              | JWT         | No           |
| `backfill-email-rules`     | Backfill missing email rules for known senders      | JWT         | No           |
| `check-inbox`              | Check IMAP inbox for new messages                   | JWT         | No           |
| `check-inbox-booking`      | Check inbox specifically for booking-related emails | JWT         | No           |
| `classify-email-response`  | Classify email responses (reply, bounce, etc.)      | JWT         | Yes          |
| `classify-emails-batch`    | Batch classification of multiple emails             | JWT         | No           |
| `classify-inbound-content` | Classify inbound email content category             | JWT         | No           |
| `classify-inbound-message` | Full inbound message classification pipeline        | JWT         | No           |
| `email-cron-sync`          | Scheduled email synchronization                     | cron-secret | No           |
| `email-delivery-webhook`   | Webhook receiver for email delivery status          | JWT         | No           |
| `email-imap-proxy`         | IMAP proxy for browser-based email access           | JWT         | No           |
| `email-sync-worker`        | Background email sync worker                        | JWT         | No           |
| `generate-email`           | AI-powered email generation                         | JWT         | Yes          |
| `imap-list-folders`        | List IMAP folders for account                       | JWT         | No           |
| `improve-email`            | AI-powered email improvement suggestions            | JWT         | Yes          |
| `manage-email-folders`     | Create/rename/delete IMAP folders                   | JWT         | Yes          |
| `mark-imap-seen`           | Mark IMAP messages as read                          | JWT         | No           |
| `process-email-queue`      | Process outbound email queue                        | JWT         | No           |
| `send-email`               | Send email via SMTP                                 | JWT         | No           |
| `suggest-email-groups`     | AI-suggested email grouping by sender/topic         | JWT         | Yes          |

### Funnemail (Email Intelligence)

| Function                       | Purpose                                        | Auth | Rate Limited |
| ------------------------------ | ---------------------------------------------- | ---- | ------------ |
| `funnemail-auto-route`         | Auto-route emails based on classification      | JWT  | No           |
| `funnemail-backfill-inbound`   | Backfill classification for historic inbound   | JWT  | No           |
| `funnemail-classify`           | Core Funnemail classification engine           | JWT  | No           |
| `funnemail-policy-engine`      | Policy evaluation for email routing            | JWT  | No           |
| `funnemail-policy-executor`    | Execute routing policies on classified emails  | JWT  | No           |
| `funnemail-reminders-tick`     | Process reminder schedule for follow-ups       | JWT  | No           |
| `funnemail-scout-sender`       | Scout and profile unknown senders              | JWT  | No           |
| `funnemail-send-autoresponder` | Send automated responses based on policy       | JWT  | No           |
| `run-funnemail-eval`           | Run eval dataset against classifier            | JWT  | No           |
| `simulate-funnemail-classify`  | Simulate classification without side effects   | JWT  | No           |
| `apply-classification-insight` | Apply learned insights to classification rules | JWT  | No           |
| `refine-classification-rule`   | Refine a classification rule from feedback     | JWT  | No           |
| `response-pattern-aggregator`  | Aggregate response patterns for analytics      | JWT  | No           |

### Partner & CRM

| Function                      | Purpose                                     | Auth        | Rate Limited |
| ----------------------------- | ------------------------------------------- | ----------- | ------------ |
| `analyze-partner`             | AI-powered partner analysis and scoring     | JWT         | No           |
| `batch-enrichment-worker`     | Batch partner enrichment worker             | cron-secret | No           |
| `calculate-lead-scores`       | Calculate AI lead scores for partners       | JWT         | Yes          |
| `calculate-partner-quality`   | Calculate partner quality scores (5-star)   | JWT         | No           |
| `deduplicate-contacts`        | AI-powered contact deduplication            | JWT         | No           |
| `deduplicate-partners`        | AI-powered partner deduplication            | JWT         | Yes          |
| `enrich-partner-website`      | Enrich partner data from website scraping   | JWT         | No           |
| `recalculate-partner-quality` | Recalculate quality scores for all partners | JWT         | No           |
| `sync-wca-partners`           | Sync partners from WCA directory            | JWT         | No           |
| `wca-country-counts`          | Count partners per country                  | JWT         | No           |

### Outreach & Multi-channel

| Function             | Purpose                                 | Auth        | Rate Limited |
| -------------------- | --------------------------------------- | ----------- | ------------ |
| `cadence-engine`     | Scheduled outreach cadence execution    | cron-secret | No           |
| `generate-outreach`  | AI-generated outreach messages          | JWT         | Yes          |
| `mission-executor`   | Execute outreach missions (multi-step)  | JWT         | No           |
| `outreach-scheduler` | Schedule outreach tasks                 | cron-secret | No           |
| `send-linkedin`      | Send LinkedIn message via bridge        | JWT         | No           |
| `send-whatsapp`      | Send WhatsApp message via bridge        | JWT         | No           |
| `review-message`     | AI editorial review before sending      | JWT         | No           |
| `smart-scheduler`    | AI-powered optimal send time scheduling | cron-secret | No           |

### LinkedIn Bridge

| Function                    | Purpose                                  | Auth | Rate Limited |
| --------------------------- | ---------------------------------------- | ---- | ------------ |
| `get-linkedin-credentials`  | Retrieve encrypted LinkedIn credentials  | JWT  | No           |
| `linkedin-ai-extract`       | AI extraction from LinkedIn profile data | JWT  | No           |
| `linkedin-profile-api`      | LinkedIn profile API proxy               | JWT  | No           |
| `save-linkedin-cookie`      | Store LinkedIn session cookie            | JWT  | No           |
| `save-linkedin-credentials` | Encrypt and store LinkedIn credentials   | JWT  | No           |

### WhatsApp Bridge

| Function                  | Purpose                                  | Auth | Rate Limited |
| ------------------------- | ---------------------------------------- | ---- | ------------ |
| `whatsapp-ai-extract`     | AI extraction from WhatsApp messages     | JWT  | No           |
| `receive-channel-message` | Receive inbound channel messages (WA/LI) | JWT  | Yes          |

### Knowledge Base & Memory

| Function                       | Purpose                                          | Auth        | Rate Limited |
| ------------------------------ | ------------------------------------------------ | ----------- | ------------ |
| `kb-doctrine-audit`            | Audit KB against commercial doctrine             | JWT         | No           |
| `kb-embed-backfill`            | Backfill embeddings for KB documents             | JWT         | No           |
| `kb-index-map`                 | Generate KB index map                            | JWT         | No           |
| `kb-ingest-document`           | Ingest document into knowledge base              | JWT         | No           |
| `kb-intake-analyze`            | Analyze document before KB ingestion             | JWT         | No           |
| `kb-promoter`                  | Promote KB entries based on usage                | cron-secret | No           |
| `kb-supervisor`                | Supervise KB quality and consistency             | JWT         | No           |
| `country-kb-generator`         | Generate country-specific KB entries             | JWT         | No           |
| `memory-embed-backfill`        | Backfill embeddings for memory entries           | JWT         | No           |
| `memory-promoter`              | Promote memory entries between levels (L1/L2/L3) | cron-secret | No           |
| `save-correction-memory`       | Save user corrections to memory                  | JWT         | No           |
| `learn-from-group-correction`  | Learn patterns from grouped corrections          | JWT         | Yes          |
| `refresh-conversation-context` | Refresh conversation context from memory         | JWT         | No           |

### Content & Generation

| Function                  | Purpose                           | Auth | Rate Limited |
| ------------------------- | --------------------------------- | ---- | ------------ |
| `categorize-content`      | AI content categorization         | JWT  | No           |
| `generate-aliases`        | Generate partner name aliases     | JWT  | No           |
| `generate-content`        | General AI content generation     | JWT  | No           |
| `harmonize-proposal-chat` | AI-powered proposal harmonization | JWT  | No           |
| `prompt-copilot-chat`     | Prompt engineering copilot chat   | JWT  | No           |

### Import & Sync

| Function                   | Purpose                                | Auth | Rate Limited |
| -------------------------- | -------------------------------------- | ---- | ------------ |
| `analyze-import-structure` | Analyze CSV/Excel import structure     | JWT  | No           |
| `process-ai-import`        | AI-powered data import processing      | JWT  | Yes          |
| `parse-business-card`      | OCR and parse business card images     | JWT  | No           |
| `sync-business-cards`      | Sync parsed business cards to contacts | JWT  | No           |
| `save-wca-contacts`        | Save contacts from WCA directory       | JWT  | No           |
| `save-wca-cookie`          | Store WCA directory session cookie     | JWT  | No           |
| `get-wca-credentials`      | Retrieve WCA directory credentials     | JWT  | No           |
| `save-ra-cookie`           | Store RA directory session cookie      | JWT  | No           |
| `save-ra-prospects`        | Save prospects from RA directory       | JWT  | No           |
| `get-ra-credentials`       | Retrieve RA directory credentials      | JWT  | No           |

### TMWE Integration

| Function              | Purpose                              | Auth        | Rate Limited |
| --------------------- | ------------------------------------ | ----------- | ------------ |
| `tmwe-catalog-sync`   | Sync TMWE product catalog            | JWT         | No           |
| `tmwe-customer-sync`  | Sync TMWE customer data              | cron-secret | No           |
| `tmwe-disconnect`     | Disconnect TMWE integration          | JWT         | No           |
| `tmwe-oauth-callback` | TMWE OAuth callback handler          | JWT         | No           |
| `tmwe-oauth-start`    | Initiate TMWE OAuth flow             | JWT         | No           |
| `tmwe-partner-link`   | Link TMWE partner to WCA partner     | JWT         | No           |
| `tmwe-partner-match`  | AI-powered TMWE-WCA partner matching | JWT         | No           |
| `tmwe-proxy`          | Proxy requests to TMWE API           | JWT         | Yes          |
| `tmwe-quote-lookup`   | Look up TMWE quotes                  | JWT         | No           |

### Voice & ElevenLabs

| Function                        | Purpose                                        | Auth | Rate Limited |
| ------------------------------- | ---------------------------------------------- | ---- | ------------ |
| `elevenlabs-conversation-token` | Generate ElevenLabs conversation session token | JWT  | No           |
| `elevenlabs-tts`                | ElevenLabs text-to-speech generation           | JWT  | No           |
| `list-elevenlabs-voices`        | List available ElevenLabs voices               | JWT  | No           |
| `tts`                           | Generic text-to-speech endpoint                | JWT  | Yes          |
| `voice-brain-bridge`            | Bridge between voice agent and AI brain        | JWT  | No           |

### Monitoring & Operations

| Function                      | Purpose                                                   | Auth        | Rate Limited |
| ----------------------------- | --------------------------------------------------------- | ----------- | ------------ |
| `dispatch-integrity-check`    | Daily coherence check between messages/activities/touches | cron-secret | No           |
| `dispatch-urgent-alert`       | Send urgent dispatch alerts via Discord                   | JWT         | No           |
| `health-check`                | System health check endpoint                              | JWT         | No           |
| `log-action`                  | Log user/system actions for audit trail                   | JWT         | No           |
| `export-audit-csv`            | Export audit data as CSV                                  | JWT         | No           |
| `record-e2e-run`              | Record E2E test run results                               | JWT         | No           |
| `prompt-registry-drift-check` | Check for prompt registry drift                           | JWT         | No           |
| `prompt-test-runner`          | Run prompt test suites                                    | cron-secret | No           |

### Misc & Utilities

| Function                         | Purpose                                       | Auth | Rate Limited |
| -------------------------------- | --------------------------------------------- | ---- | ------------ |
| `browser-action`                 | Execute browser automation actions            | JWT  | No           |
| `check-external-db`              | Check external database connectivity          | JWT  | No           |
| `confirm-injection-review`       | Confirm/reject flagged injection attempts     | JWT  | No           |
| `consume-credits`                | Deduct credits for paid operations            | JWT  | No           |
| `finder-api-chat`                | Finder API conversational interface           | JWT  | No           |
| `install-vault-service-role-key` | One-shot bootstrap for vault service role key | JWT  | No           |
| `optimus-analyze`                | Optimus AI analysis engine                    | JWT  | No           |
| `parse-profile-ai`               | AI-powered profile parsing                    | JWT  | No           |
| `process-download-job`           | Process background download jobs              | JWT  | No           |
| `process-inbound-enrichment`     | Process inbound data enrichment               | JWT  | No           |
| `replay-domain-events`           | Replay domain events for recovery             | JWT  | No           |
| `scrape-website`                 | Scrape and extract website content            | JWT  | Yes          |
| `sherlock-extract`               | Sherlock AI investigative extraction          | JWT  | No           |
| `super-mario`                    | Admin super-utility function                  | JWT  | No           |

## Cron Functions

| Function                   | Schedule             | Purpose                                                                    |
| -------------------------- | -------------------- | -------------------------------------------------------------------------- |
| `dispatch-integrity-check` | Daily 03:15 UTC      | Verify coherence between channel_messages, activities, and partner touches |
| `agent-prompt-refiner`     | Weekly Mon 04:00 UTC | AI-driven prompt improvement suggestions                                   |
| `prompt-test-runner`       | Daily 03:00 UTC      | Run prompt test suites and record results                                  |
| `agent-autonomous-cycle`   | Periodic             | Autonomous agent execution cycle                                           |
| `agent-autopilot-worker`   | Periodic             | Background autopilot task worker                                           |
| `agent-task-drainer`       | Periodic             | Drain pending agent tasks from queue                                       |
| `batch-enrichment-worker`  | Periodic             | Batch partner enrichment                                                   |
| `cadence-engine`           | Periodic             | Outreach cadence execution                                                 |
| `email-cron-sync`          | Periodic             | Email synchronization                                                      |
| `kb-promoter`              | Periodic             | KB entry promotion                                                         |
| `memory-promoter`          | Periodic             | Memory level promotion (L1->L2->L3)                                        |
| `outreach-scheduler`       | Periodic             | Outreach scheduling                                                        |
| `smart-scheduler`          | Periodic             | AI optimal send-time scheduling                                            |
| `tmwe-customer-sync`       | Periodic             | TMWE customer data sync                                                    |

All cron functions authenticate via `x-cron-secret` from Vault (never hardcoded).

## Rules

1. **Never** use `as any` — define interfaces for all data shapes
2. **Always** include CORS headers in ALL responses (including errors)
3. **Always** use `catch (error: unknown)` with proper type narrowing
4. **Never** hardcode secrets — use `Deno.env.get()`
5. **Never** modify reserved schemas (auth, storage, realtime)
6. Keep files under 200 LOC — extract to shared modules
7. Use `edgeError()` for consistent error response format

## Deploy

Edge Functions deploy automatically via Lovable when changes are pushed to GitHub. Manual deploy: `supabase functions deploy <name>`.
