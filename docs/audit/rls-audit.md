# RLS Audit — Sprint G (2026-05-13)

## Scope

Full audit of Row-Level Security across all 343 tables in the `public` schema (source: `src/integrations/supabase/types.ts`).

## Summary

| Category                   | Count | RLS Required                                      | Notes                                                                                                                                                                  |
| -------------------------- | ----- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backup / temp tables       | 3     | No (read-only archive)                            | `_backup_imported_contacts_2026_05_01`, `_backup_partner_contacts_2026_05_01`, `_backup_partners_2026_05_01`                                                           |
| Cron / system internal     | ~15   | Admin-only policy                                 | `_cron_invoke_edge_sql`, `cron_job_status`, `cron_recent_runs`, `cron_run_log`, `cron_runs`, `cron_service_headers`, `system_flags`, `system_settings`, `app_settings` |
| User-owned data            | ~80+  | Yes — `user_id = auth.uid()`                      | `imported_contacts`, `partners`, `partner_contacts`, `deals`, `activities`, `interactions`, `email_drafts`, `email_send_log`, `notifications`, `reminders`, etc.       |
| AI / agent tables          | ~50   | Yes — `user_id = auth.uid()` or service-role only | `ai_conversations`, `ai_memory`, `ai_decision_log`, `ai_pending_actions`, `ai_prompt_log`, `agent_missions`, `agent_tasks`, etc.                                       |
| Organization-scoped        | ~20   | Yes — org membership check                        | `organization_members`, `operators`, `team_members`, `client_assignments`, `shared_mailboxes`, `operator_mailbox_access`                                               |
| Edge function logs / audit | ~25   | Service-role insert, user read own                | `edge_function_logs`, `edge_metrics`, `supervisor_audit_log`, `ai_invocation_audit`, `request_logs`, `app_error_logs`                                                  |
| Funnemail domain           | ~20   | Yes — user_id / operator scope                    | `funnemail_decisions`, `funnemail_actions_log`, `funnemail_message_claims`, `funnemail_policy`, `funnemail_routing_rules`, etc.                                        |
| TMWE integration           | ~10   | Yes — user connection scope                       | `tmwe_user_tokens`, `tmwe_partner_links`, `tmwe_proxy_audit`, `tmwe_request_audit`, etc.                                                                               |
| RPC functions / views      | ~60   | N/A (SECURITY DEFINER)                            | Functions like `get_dashboard_snapshot`, `merge_duplicate_partners`, `match_contacts_to_wca`, views like `vw_partner_quality_scores`                                   |
| Credential / secret tables | ~10   | Critical — strict user_id match                   | `user_api_keys`, `user_wca_credentials`, `user_wca_sessions`, `user_linkedin_sessions`, `user_ra_sessions`, `bridge_tokens`, `oauth_state`                             |

## RLS Policy Recommendations

### Critical Priority (credential/secret tables)

These tables MUST have RLS enabled with strict `user_id = auth.uid()` policies:

- `user_api_keys` — SELECT/INSERT/UPDATE/DELETE restricted to owner
- `user_wca_credentials` — SELECT/UPDATE restricted to owner
- `user_wca_sessions` — SELECT/UPDATE/DELETE restricted to owner
- `user_linkedin_sessions` — SELECT/UPDATE/DELETE restricted to owner
- `user_ra_sessions` — SELECT/UPDATE/DELETE restricted to owner
- `bridge_tokens` — SELECT restricted to owner, INSERT via service-role
- `oauth_state` — SELECT restricted to owner
- `prompt_injection_reviews` — SELECT/UPDATE restricted to owner

### High Priority (user-owned business data)

Standard pattern: `USING (user_id = auth.uid())` for SELECT, `WITH CHECK (user_id = auth.uid())` for INSERT/UPDATE:

- `imported_contacts`
- `partners`
- `partner_contacts`
- `deals`, `deal_activities`
- `activities`
- `interactions`, `contact_interactions`
- `email_drafts`, `email_send_log`, `email_templates`
- `notifications`, `reminders`
- `ai_conversations`, `ai_memory`, `ai_pending_actions`
- `outreach_missions`, `outreach_queue`, `outreach_schedules`
- `prospects`, `prospect_contacts`, `prospect_interactions`
- `download_jobs`, `download_queue`
- `business_cards`
- `kb_entries`

### Medium Priority (org-scoped tables)

Pattern: join on `organization_members` to verify membership:

- `operators`
- `organization_members`
- `team_members`
- `client_assignments`
- `shared_mailboxes`
- `operator_mailbox_access`
- `commercial_playbooks`, `commercial_workflows`

### Low Priority (system/audit — service-role access)

These tables should have RLS enabled but only allow service-role writes. User reads should be scoped to their own records where applicable:

- `edge_function_logs`
- `edge_metrics`
- `supervisor_audit_log`
- `ai_invocation_audit`
- `cron_run_log`, `cron_runs`
- `request_logs`
- `app_error_logs`

## Existing Security Layers

The project already has several defense layers in the edge function tier:

1. **authGuard.ts** — Bearer token validation via `getClaims()`
2. **injectionGuard.ts** — Prompt injection confirmation flow with DB-backed review
3. **promptSanitizer.ts** — Pattern-based injection detection and redaction
4. **rateLimiter.ts** — In-memory token bucket rate limiter
5. **securityHeaders.ts** — CSP + security headers for edge responses
6. **aiActionRiskGate.ts** — Risk-gated AI action approval
7. **ownership.ts** — Resource ownership verification
8. **csrfProtection.ts** — CSRF token handling
9. **internalAuth.ts** — Service-to-service auth

## Action Items

1. Enable RLS on all credential tables (Critical)
2. Add `user_id = auth.uid()` policies to user-owned data tables (High)
3. Add org-membership policies to organization-scoped tables (Medium)
4. Add service-role-only insert + user-read-own policies to audit tables (Low)
5. Verify all RPC functions use `SECURITY DEFINER` with proper checks
