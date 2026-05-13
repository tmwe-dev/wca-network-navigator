# WCA Network Navigator — Runbook

> Operational guide: what to do when a health check is red.
> Last updated: 2026-05-13 (Sprint K)

## Health Dashboard

The Health Dashboard (`/v2/admin/health`) monitors 9 system indicators. Each check has a green/amber/red status. Below are the remediation steps for each.

---

### 1. Database Connectivity

**What it checks:** Simple SELECT query completes within 5 seconds.

**Symptoms when down:**

- App shows "Failed to load" on every page
- All data fetches return errors
- Edge functions log connection timeout errors

**Diagnosis steps:**

1. Check Supabase Dashboard > Database > Connection Pooler status
2. Check if project hit connection limit (Settings > Database > Connection pooling)
3. Run `SELECT 1` in Supabase SQL Editor to test connectivity
4. Check `pg_stat_activity` for long-running queries or connection exhaustion

**Fix / restart procedure:**

- If project is paused: restore from Dashboard > Settings > General
- If connections exhausted: kill idle connections via `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND query_start < now() - interval '10 minutes'`
- If pooler is down: toggle connection pooling off/on in Dashboard > Settings > Database
- Emergency: use Global Pause toggle in admin panel (`/v2/admin/settings`) to reduce load

---

### 2. Edge Functions Reachable

**What it checks:** Whether key edge functions (health-check, ai-gateway-micro) respond within timeout.

**Symptoms when down:**

- AI features return errors
- Email operations fail
- Agent actions not executing
- Console shows 502/503 errors on function invocations

**Diagnosis steps:**

1. Check Supabase Dashboard > Edge Functions > Logs for errors
2. Verify environment variables are set (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, AI gateway keys)
3. Check if Supabase project is paused (Dashboard > Settings > General)
4. Test individual function: `curl -X POST https://<project>.supabase.co/functions/v1/health-check -H "Authorization: Bearer <jwt>"`

**Fix / restart procedure:**

- If env vars missing: re-set in Supabase Dashboard > Edge Functions > Secrets
- If function crashed: redeploy with `supabase functions deploy <function-name>`
- If all functions down: check Supabase platform status page
- If specific function failing: check its logs, look for import errors or Deno compatibility issues

---

### 3. Auth Service

**What it checks:** Supabase Auth responds to health probe, session refresh works.

**Symptoms when down:**

- Users cannot log in
- Existing sessions expire and cannot refresh
- All authenticated API calls return 401
- Edge functions reject all requests with auth errors

**Diagnosis steps:**

1. Check Supabase Dashboard > Authentication > Users for recent sign-ins
2. Try `supabase auth` commands from CLI
3. Check if `authorized_users` table has entries
4. Verify auth settings in Dashboard > Authentication > Settings

**Fix / restart procedure:**

- If auth service is down: this is a Supabase platform issue, check status page
- If JWT verification failing: check SUPABASE_JWT_SECRET env var in Edge Functions
- If users locked out: verify `authorized_users` whitelist table has correct entries
- If session refresh fails: check auth token expiry settings (Dashboard > Authentication > Settings)

---

### 4. AI Gateway

**What it checks:** AI gateway endpoint responds to health probe, at least one provider is reachable.

**Symptoms when down:**

- Email classification stops working
- Agent responses fail
- "AI unavailable" errors in UI
- `ai_interaction_log` shows consecutive failures

**Diagnosis steps:**

1. Check Lovable AI Gateway status
2. Verify API keys in Supabase Vault are valid and not expired
3. Check token/credit balance with individual AI providers
4. Check `ai_interaction_log` for recent error patterns (429 = rate limit, 401 = key expired)
5. Check `rate_limit_violations` table for throttling

**Fix / restart procedure:**

- If API key expired: rotate key in Supabase Vault, update `aiGatewayConfig.ts` if needed
- If quota exhausted: top up credits with the provider, or switch routing to alternative provider
- If gateway itself down: fallback is `ai-gateway-micro` which calls providers directly
- If rate limited: wait for bucket refill, or increase limits in `rateLimiter.ts`

---

### 5. Email Processing (IMAP)

**What it checks:** IMAP connection to configured email server succeeds, recent emails are being fetched and classified.

**Symptoms when down:**

- New emails not appearing in inbox view
- Funnemail classification not running
- Email pipeline tab shows stale data
- `check-inbox` edge function logs connection errors

**Diagnosis steps:**

1. Check `check-inbox` edge function logs for IMAP connection errors
2. Verify IMAP credentials in `app_settings` table
3. Check if email server is reachable (may be firewall or IP block)
4. Run `imap-list-folders` to test IMAP connectivity
5. Check `classify-inbound-message` logs for AI errors (quota, timeout)
6. Verify `email_address_rules` has entries for known senders

**Fix / restart procedure:**

- If IMAP credentials wrong: update in app_settings via admin panel
- If email server blocking: check IP whitelist on email server, Supabase Edge Functions use dynamic IPs
- If classification failing but IMAP works: check AI gateway (see check 4)
- If `email-cron-sync` stopped: verify pg_cron entry exists and cron secret is current
- Manual sync: invoke `check-inbox` edge function directly with JWT

---

### 6. LinkedIn Bridge

**What it checks:** LinkedIn session cookie is valid, `linkedin-profile-api` responds.

**Symptoms when down:**

- LinkedIn profile enrichment fails
- Outreach missions with LinkedIn channel show errors
- `send-linkedin` returns auth errors
- LinkedIn AI extraction produces empty results

**Diagnosis steps:**

1. Check `get-linkedin-credentials` to verify stored credentials exist
2. Check `linkedin-profile-api` logs for session expiry errors
3. Verify LinkedIn cookie is not expired (cookies expire frequently)
4. Check if LinkedIn has blocked/rate-limited the session

**Fix / restart procedure:**

- If cookie expired: user must re-login to LinkedIn and update cookie via `save-linkedin-cookie`
- If credentials expired: re-save via `save-linkedin-credentials`
- If LinkedIn blocking requests: wait 24h, reduce request frequency in outreach scheduler
- If extraction failing but connection works: check `linkedin-ai-extract` AI gateway status

---

### 7. WhatsApp Bridge

**What it checks:** WhatsApp message sending works, `receive-channel-message` processes inbound.

**Symptoms when down:**

- WhatsApp outreach messages not delivered
- Inbound WhatsApp messages not appearing
- `send-whatsapp` edge function returns errors
- `whatsapp-ai-extract` fails to process messages

**Diagnosis steps:**

1. Check `send-whatsapp` edge function logs
2. Check `receive-channel-message` logs for inbound processing errors
3. Verify WhatsApp session/API credentials
4. Check `channel_messages` table for recent WhatsApp entries

**Fix / restart procedure:**

- If session expired: re-authenticate WhatsApp session
- If inbound not processing: check `receive-channel-message` function deployment
- If AI extraction failing: check AI gateway (see check 4)
- If messages queued but not sent: check `process-email-queue` (shared outbound queue)

---

### 8. Cron Jobs

**What it checks:** All scheduled crons executed within their expected window.

**Symptoms when down:**

- Dispatch integrity report not updated (stale date)
- Prompt test results not refreshing
- Email sync not running on schedule
- Agent task queue growing without draining

**Diagnosis steps:**

1. Check Dashboard > Database > Extensions > pg_cron
2. Verify cron entries exist for all required jobs
3. Check `pg_cron.job_run_details` for failure reasons
4. Verify cron secret in Vault matches what functions expect

**Fix / restart procedure:**

- If cron entries missing: re-create with SQL (see migration scripts or sprint-completi.md for exact SQL)
- If cron secret expired: rotate in Vault, update pg_cron job definitions
- If pg_cron extension disabled: enable via `CREATE EXTENSION IF NOT EXISTS pg_cron`
- If function timeout: check if the cron-triggered function has performance issues
- Key cron schedule:
  - `dispatch-integrity-check`: daily 03:15 UTC
  - `prompt-test-runner`: daily 03:00 UTC
  - `agent-prompt-refiner`: weekly Mon 04:00 UTC

---

### 9. Dispatch Integrity

**What it checks:** Last `dispatch-integrity-check` run result shows no critical mismatches.

**Symptoms when down:**

- Dispatch integrity report shows failures
- Orphaned messages in `channel_messages` without matching `activities`
- Partner touch counts inconsistent with actual communication
- Timeline view shows gaps

**Diagnosis steps:**

1. Check `dispatch_integrity_report` table for specific failure types
2. Common failures: orphaned channel_messages, missing activity records, touch count mismatches
3. Run dispatch-integrity-check manually to get fresh report
4. Cross-check `channel_messages` vs `activities` for the flagged partner_ids

**Fix / restart procedure:**

- If no recent run: check cron job (see check 8), or run manually via POST to `dispatch-integrity-check` with `x-cron-secret` header
- If orphaned messages found: create missing activity records via admin panel or SQL
- If touch count mismatch: run `recalculate-partner-quality` to recompute
- If systematic drift: investigate the root cause (e.g., `send-email` not logging activities), fix the pipeline, then re-run integrity check
- Urgent alert: `dispatch-urgent-alert` can notify via Discord for critical mismatches

---

## General Escalation Path

1. Check Supabase Dashboard logs first (Edge Functions > Logs)
2. Check frontend errors in Sentry
3. If AI-related: check token usage in `ai_interaction_log`
4. If database-related: check `pg_stat_activity` for long-running queries
5. Emergency pause: use Global Pause toggle in admin panel (`/v2/admin/settings`)
6. Notify team via Discord alert (manual or via `dispatch-urgent-alert`)

## Scheduled Maintenance

| Task                               | Frequency       | Owner    |
| ---------------------------------- | --------------- | -------- |
| Review pending actions queue       | Daily           | Operator |
| Check dispatch integrity report    | Daily           | Admin    |
| Review Funnemail eval accuracy     | Weekly          | Admin    |
| Review rate_limit_violations       | Weekly          | Admin    |
| Rotate API keys                    | Monthly         | Admin    |
| Review edge function metrics panel | Weekly          | Admin    |
| Database vacuum/analyze            | Auto (Supabase) | System   |
