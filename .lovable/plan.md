

# Plan: Prompt 91 — Security Hardening

## What this does

Comprehensive security audit and hardening across the entire system: fix permissive RLS policies, add auth checks to unprotected Edge Functions, add rate limiting and input sanitization shared modules, and verify admin page guards.

---

## Step 1 — Fix Permissive RLS Policies (Migration)

The linter flagged 1 warning. Full audit found ~30 `USING(true)` / `WITH CHECK(true)` policies across these tables:

**Tables that NEED user_id scoping** (have `user_id` column):
- `email_drafts` — currently `FOR ALL USING(true)` → scope to `auth.uid() = user_id`
- `app_settings` — SELECT/INSERT/UPDATE all `(true)` → scope to `auth.uid() = user_id`

**Tables that are legitimately shared** (team-wide data, no `user_id` — document with comments):
- `network_configs` — shared config for WCA networks (all authenticated users need access)
- `blacklist_entries`, `blacklist_sync_log` — team-shared blacklists
- `prospects`, `partners_no_contacts` — shared team data (pending `team_id` migration per memory)
- `voice_call_sessions`, `request_logs`, `ai_request_log`, `ai_session_briefings` — telemetry/logging tables (INSERT-only for authenticated is acceptable)

**Action**: Single migration that:
- Drops and recreates policies for `email_drafts` and `app_settings` with `auth.uid() = user_id`
- Adds SQL comments documenting why shared tables use `(true)`

---

## Step 2 — Auth Check on 25 Unprotected Edge Functions

Found 25 functions without auth. Classification:

**Cron/service-role (no change needed — 7)**:
`agent-autonomous-cycle`, `ai-backup`, `cadence-engine`, `daily-briefing`, `kb-promoter`, `memory-promoter`, `smart-scheduler`

**Deprecated stubs (no change needed — 2)**:
`deep-search-contact`, `deep-search-partner`

**Cookie/extension save functions (extension-origin validated, no user auth — keep as-is — 4)**:
`save-linkedin-cookie`, `save-ra-cookie`, `save-ra-prospects`, `save-wca-contacts`

**Proxy/router functions (forward to authed functions — add auth before forwarding — 3)**:
`ai-utility`, `generate-content`, `unified-assistant`

**Need auth added (9 functions)**:
- `classify-email-response` — add Bearer token check
- `country-kb-generator` — add Bearer token check
- `deduplicate-partners` — add Bearer token check
- `email-imap-proxy` — add Bearer token check
- `list-elevenlabs-voices` — add Bearer token check
- `response-pattern-aggregator` — add Bearer token check
- `voice-brain-bridge` — already has bridge_token validation, acceptable
- `wca-country-counts` — add Bearer token check
- `calculate-lead-scores` — uses service_role but called from client; add auth

For each: add the standard auth pattern at function start (extract Bearer token, call `getUser`, return 401 if invalid).

---

## Step 3 — Rate Limiter Shared Module

Create `supabase/functions/_shared/rateLimiter.ts`:
- In-memory Map-based rate limiting (key → count + resetAt)
- `checkRateLimit(key, maxRequests, windowMs)` returning `{ allowed, remaining, retryAfter }`

Apply to 5 high-cost functions:
- `ai-assistant` — 20 req/min
- `generate-email` — 30 req/min
- `suggest-email-groups` — 5 req/min
- `classify-email-response` — 60 req/min
- `agent-execute` — 15 req/min

---

## Step 4 — Input Validator Shared Module

Create `supabase/functions/_shared/inputValidator.ts`:
- `sanitizeString(input, maxLength)` — truncate + trim
- `validateUUID(input)` — regex check
- `validateEmail(input)` — regex check

Apply to `ai-assistant`, `generate-email`, `agent-execute` for all user-provided text/ID/email fields.

---

## Step 5 — Admin Page Guards

Verify admin guards on:
- Telemetry page
- Diagnostics page
- Any page showing cross-user data

Add `useRequireRole('admin')` or profile-based `is_admin` check where missing.

---

## Step 6 — Verify

- 0 TypeScript errors
- Linter re-run shows 0 warnings
- `health-check` remains public
- Cron functions continue working with service_role_key
- Cookie-save functions continue working for extensions

---

## Files created/modified

| Action | File |
|--------|------|
| Create | `supabase/functions/_shared/rateLimiter.ts` |
| Create | `supabase/functions/_shared/inputValidator.ts` |
| Create | Migration fixing RLS policies |
| Edit | 9 Edge Functions (add auth check) |
| Edit | 5 Edge Functions (add rate limiting) |
| Edit | 3 Edge Functions (add input validation) |

