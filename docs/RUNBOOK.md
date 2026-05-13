# WCA Network Navigator — Runbook

> Operational guide: what to do when something is down.
> Last updated: 2026-05-13 (Sprint K)

## Health Dashboard Checks

The Health Dashboard (`/v2/admin/health`) monitors 9 system indicators. Each check has a green/amber/red status. Below are the remediation steps for each.

### 1. Edge Functions Online

**What it checks:** Whether key edge functions respond within timeout.

**If RED:**
- Check Supabase Dashboard > Edge Functions > Logs for errors
- Verify environment variables are set (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, AI gateway keys)
- Check if Supabase project is paused (Dashboard > Settings > General)
- Redeploy: `supabase functions deploy <function-name>`

### 2. Database Connection

**What it checks:** Simple SELECT query completes within 5s.

**If RED:**
- Check Supabase Dashboard > Database > Connection Pooler status
- Check if project hit connection limit (Settings > Database > Connection pooling)
- If paused: restore from Dashboard > Settings > General

### 3. AI Gateway Availability

**What it checks:** AI gateway endpoint responds to health probe.

**If RED:**
- Check Lovable AI Gateway status at https://ai.gateway.lovable.dev
- Verify API keys in Supabase Vault are valid and not expired
- Check token/credit balance with AI providers

### 4. Pending Actions Queue Depth

**What it checks:** Count of ai_pending_actions with status='pending'.

**If AMBER (>50):** Normal during batch operations; monitor trend.
**If RED (>200):**
- Check if agent-task-drainer cron is running (Dashboard > Edge Functions > Logs)
- Manually invoke drainer: POST to agent-task-drainer edge function
- Check if AI gateway is throttling (check error logs for 429s)

### 5. Dispatch Integrity

**What it checks:** Last dispatch-integrity-check run result.

**If RED (no recent run):**
- Verify cron is configured in Supabase Dashboard > Database > Extensions > pg_cron
- Cron expression: `15 3 * * *` (daily 03:15 UTC)
- Manual run: POST to dispatch-integrity-check with x-cron-secret header

**If RED (integrity failures):**
- Check dispatch_integrity_report table for specific failure types
- Common: orphaned channel_messages without matching activities
- Fix: run reconciliation query or manual activity creation

### 6. Prompt Lab Health

**What it checks:** 3 axes — test coverage, duplicate detection, persona completeness.

**If RED on test coverage:**
- Navigate to Prompt Lab > Test Runner
- Ensure each operative prompt has at least 1 test case
- Run ai-test-runner manually if cron missed

**If RED on duplicates:**
- Check operative_prompts for entries with same scope
- Deactivate duplicates (set is_active = false)

**If RED on personas:**
- Check agent_personas table — each should have custom_tone_prompt >= 300 chars
- Seed missing personas via Sprint E migration

### 7. RLS Coverage

**What it checks:** All user-facing tables have RLS enabled and meaningful policies.

**If RED:**
- Run: `SELECT tablename FROM pg_tables WHERE schemaname='public' AND NOT rowsecurity;`
- For each exposed table, add appropriate RLS policy
- User-scoped: `USING (auth.uid() = user_id)`
- Admin-scoped: `USING (public.has_role(auth.uid(), 'admin'))`

### 8. Email Pipeline Status

**What it checks:** Recent email classification success rate.

**If RED:**
- Check check-inbox edge function logs
- Verify IMAP credentials in app_settings
- Check classify-inbound-message for AI errors (quota, timeout)
- Verify email_address_rules has entries for known senders

### 9. Cron Jobs Active

**What it checks:** All scheduled crons executed within their expected window.

**If RED:**
- Dashboard > Database > Extensions > pg_cron
- Verify entries exist for: dispatch-integrity-check, agent-prompt-refiner, ai-test-runner
- Check pg_cron.job_run_details for failure reasons
- Common issue: expired cron secret — rotate in Vault

## General Escalation

1. Check Supabase Dashboard logs first (Edge Functions > Logs)
2. Check frontend errors in Sentry
3. If AI-related: check token usage in ai_interaction_log
4. If database-related: check pg_stat_activity for long-running queries
5. Emergency pause: use Global Pause toggle in admin panel (`/v2/admin/settings`)

## Scheduled Maintenance

| Task | Frequency | Owner |
|------|-----------|-------|
| Review pending actions queue | Daily | Operator |
| Check dispatch integrity report | Daily | Admin |
| Review Funnemail eval accuracy | Weekly | Admin |
| Rotate API keys | Monthly | Admin |
| Review rate_limit_violations | Weekly | Admin |
| Database vacuum/analyze | Auto (Supabase) | System |
