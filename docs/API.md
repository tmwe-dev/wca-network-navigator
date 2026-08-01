# API Reference — WCA Network Navigator Edge Functions

All endpoints are at `POST /functions/v1/{function-name}` unless noted otherwise.
All authenticated endpoints require `Authorization: Bearer <token>` header.

---

### POST /functions/v1/health-check
**Description:** Returns health status of all backend services.
**Auth:** None required
**Response 200:**
| Field | Type | Description |
|-------|------|-------------|
| status | "healthy" \| "degraded" | Overall status |
| checks | object | Per-service status (database, auth, storage, ai_gateway) |
| timestamp | string | ISO timestamp |

---

### POST /functions/v1/ai-assistant
**Description:** Processes user messages with 7-block context assembly and multi-model AI routing.
**Auth:** Bearer token required
**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| message | string | Yes | User message (max 10000 chars) |
| conversationId | string | No | Existing conversation UUID |
| context | object | No | Page context metadata |
**Response 200:**
| Field | Type | Description |
|-------|------|-------------|
| response | string | AI assistant response |
| conversationId | string | Conversation UUID |
**Errors:** 401 Unauthorized, 429 Rate Limited, 500 Internal Error

---

### POST /functions/v1/agent-execute
**Description:** Executes an AI agent task with tool calling and context injection.
**Auth:** Bearer token required
**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| agentId | string | Yes | Agent UUID |
| message | string | Yes | User instruction |
| conversationHistory | array | No | Previous messages |
**Response 200:**
| Field | Type | Description |
|-------|------|-------------|
| response | string | Agent response text |
| toolCalls | array | Tools invoked during execution |
**Errors:** 401, 429, 500

---

### POST /functions/v1/agent-autonomous-cycle
**Description:** Runs an autonomous agent cycle processing pending tasks.
**Auth:** Bearer token required
**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| agentId | string | Yes | Agent UUID |
| context | object | No | Additional context |
**Response 200:** `{ success: boolean, tasksProcessed: number }`
**Errors:** 401, 500

---

### POST /functions/v1/classify-email-response
**Description:** Classifies inbound emails into 9 categories with sentiment analysis and auto-escalation.
**Auth:** Bearer token required
**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| user_id | string | Yes | User UUID |
| email_address | string | Yes | Sender email |
| subject | string | Yes | Email subject |
| body | string | Yes | Email body text |
**Response 200:**
| Field | Type | Description |
|-------|------|-------------|
| category | string | One of 9 categories |
| confidence | number | 0-1 confidence score |
| sentiment | string | positive/negative/neutral/mixed |
| action_suggested | string | Recommended next action |
**Errors:** 401, 429, 500

---

### POST /functions/v1/generate-email
**Description:** Generates personalized outreach emails with multi-block context assembly.
**Auth:** Bearer token required
**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| partnerId | string | Yes | Target partner UUID |
| contactId | string | No | Specific contact UUID |
| emailType | string | Yes | Type of email (intro, followup, etc.) |
| prompt | string | No | Custom instructions (max 5000 chars) |
**Response 200:**
| Field | Type | Description |
|-------|------|-------------|
| subject | string | Generated subject line |
| body | string | Generated email body (HTML) |
**Errors:** 401, 429, 500

---

### POST /functions/v1/generate-outreach
**Description:** Generates outreach content with territory and playbook context.
**Auth:** Bearer token required
**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| partnerId | string | Yes | Target partner UUID |
| channel | string | Yes | Channel (email, whatsapp, linkedin) |
| tone | string | No | Desired tone |
**Errors:** 401, 429, 500

---

### POST /functions/v1/generate-content
**Description:** General-purpose content generation (templates, KB articles, etc.).
**Auth:** Bearer token required
**Errors:** 401, 500

---

### POST /functions/v1/process-email-queue
**Description:** Processes queued outbound emails via Resend API.
**Auth:** Service-level (internal cron)
**Errors:** 500

---

### POST /functions/v1/sync-business-cards
**Description:** Syncs and matches scanned business cards to CRM partners/contacts.
**Auth:** Bearer token required
**Errors:** 401, 500

---

### POST /functions/v1/parse-business-card
**Description:** OCR extraction from business card images using AI vision.
**Auth:** Bearer token required
**Errors:** 401, 500

---

### POST /functions/v1/ai-match-business-cards
**Description:** AI-powered fuzzy matching of business cards to existing CRM records.
**Auth:** Bearer token required
**Errors:** 401, 500

---

### POST /functions/v1/analyze-partner
**Description:** Deep AI analysis of a partner's profile and enrichment data.
**Auth:** Bearer token required
**Errors:** 401, 429, 500

---

### POST /functions/v1/enrich-partner-website
**Description:** Scrapes and enriches partner data from their website.
**Auth:** Bearer token required
**Errors:** 401, 500

---

### POST /functions/v1/deduplicate-partners
**Description:** Finds and merges duplicate partner records using fuzzy matching.
**Auth:** Bearer token required
**Errors:** 401, 500

---

### POST /functions/v1/daily-briefing
**Description:** Generates a daily AI briefing summarizing pending tasks and metrics.
**Auth:** Bearer token required
**Errors:** 401, 500

---

### POST /functions/v1/cadence-engine
**Description:** Manages follow-up cadences and schedules next touchpoints.
**Auth:** Bearer token required
**Errors:** 401, 500

---

### POST /functions/v1/kb-embed-backfill
**Description:** Backfills vector embeddings for knowledge base entries.
**Auth:** Service-level
**Errors:** 500

---

### POST /functions/v1/suggest-email-groups
**Description:** AI-suggests groupings for email address rules.
**Auth:** Bearer token required
**Errors:** 401, 500

---

### POST /functions/v1/check-inbox
**Description:** IMAP inbox check and email sync trigger.
**Auth:** Bearer token required
**Errors:** 401, 500

---

### POST /functions/v1/email-imap-proxy
**Description:** IMAP proxy for email operations (fetch, move, flag).
**Auth:** Bearer token required
**Errors:** 401, 500

---

### POST /functions/v1/email-sync-worker
**Description:** Background worker for incremental email synchronization.
**Auth:** Service-level
**Errors:** 500

---

### POST /functions/v1/mark-imap-seen
**Description:** Marks IMAP messages as seen/read.
**Auth:** Bearer token required
**Errors:** 401, 500

---

### POST /functions/v1/send-email
**Description:** Sends an email via Resend with tracking.
**Auth:** Bearer token required
**Errors:** 401, 500

---

### POST /functions/v1/improve-email
**Description:** AI-powered email improvement suggestions.
**Auth:** Bearer token required
**Errors:** 401, 429, 500

---

### POST /functions/v1/generate-aliases
**Description:** Generates company/contact aliases for fuzzy matching.
**Auth:** Bearer token required
**Errors:** 401, 500

---

### POST /functions/v1/deep-search-partner
**Description:** Deep web search for partner intelligence.
**Auth:** Bearer token required
**Errors:** 401, 429, 500

---

### POST /functions/v1/deep-search-contact
**Description:** Deep web search for contact intelligence.
**Auth:** Bearer token required
**Errors:** 401, 429, 500

---

### POST /functions/v1/process-download-job
**Description:** Processes WCA directory download jobs.
**Auth:** Bearer token required
**Errors:** 401, 500

---

### POST /functions/v1/sync-wca-partners
**Description:** Syncs partners from WCA directory cache.
**Auth:** Bearer token required
**Errors:** 401, 500

---

### POST /functions/v1/save-wca-contacts
**Description:** Saves contacts extracted from WCA profiles.
**Auth:** Bearer token required
**Errors:** 401, 500

---

### POST /functions/v1/wca-country-counts
**Description:** Returns member counts per country from WCA directory.
**Auth:** Bearer token required
**Errors:** 401, 500

---

### POST /functions/v1/check-subscription
**Description:** Checks user's Stripe subscription status.
**Auth:** Bearer token required
**Errors:** 401, 500

---

### POST /functions/v1/ai-utility
**Description:** Multi-purpose AI utility endpoint (summarize, translate, extract).
**Auth:** Bearer token required
**Errors:** 401, 429, 500

---

### POST /functions/v1/linkedin-profile-api
**Description:** Fetches LinkedIn profile data via saved session.
**Auth:** Bearer token required
**Errors:** 401, 500

---

### POST /functions/v1/mission-executor
**Description:** Executes outreach mission actions with slot management.
**Auth:** Bearer token required
**Errors:** 401, 500

---

### POST /functions/v1/smart-scheduler
**Description:** AI-powered scheduling for optimal send times.
**Auth:** Bearer token required
**Errors:** 401, 500

---

### POST /functions/v1/voice-brain-bridge
**Description:** Bridge between ElevenLabs voice agents and backend logic.
**Auth:** Bridge token
**Errors:** 401, 500

---

### POST /functions/v1/stripe-webhook
**Description:** Handles Stripe webhook events (subscriptions, payments).
**Auth:** Stripe signature verification
**Errors:** 400, 500
