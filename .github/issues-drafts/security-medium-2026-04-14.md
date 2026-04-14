# Security Issues — Medium Priority

Discovered during audit 2026-04-14. These should be addressed in upcoming sprints.

## M1: team_members — no ownership scoping
- **Severity**: MEDIUM
- **Tables**: `team_members`
- **Issue**: Policies only check `auth.uid() IS NOT NULL`. Any authenticated user can CRUD all team members.
- **Fix**: Add `user_id` column or restrict write operations to admin role via `is_operator_admin()`.

## M2: Realtime channels — no topic authorization
- **Severity**: MEDIUM  
- **Tables**: 10 tables published to Realtime (channel_messages, outreach_queue, activities, agent_tasks, etc.)
- **Issue**: No RLS on `realtime.messages`. Any authenticated user can subscribe to any channel.
- **Fix**: Add RLS policies on `realtime.messages` scoping topic access by `auth.uid()`.

## M3: operators — encrypted credentials visible to all admins
- **Severity**: MEDIUM
- **Tables**: `operators`
- **Issue**: `imap_password_encrypted` and `smtp_password_encrypted` visible to any admin via `is_operator_admin()`.
- **Fix**: Move credentials to separate table with `user_id = auth.uid()` SELECT policy only.

## M4: kb_entries — public role reads system doctrine
- **Severity**: MEDIUM
- **Tables**: `kb_entries`
- **Issue**: SELECT policy targets `public` role for `user_id IS NULL` rows (AI system prompts).
- **Fix**: Change policy target role from `public` to `authenticated`.

## M5: email_templates — anon access to ownerless templates
- **Severity**: MEDIUM
- **Tables**: `email_templates`
- **Issue**: `public` role can read/delete templates where `user_id IS NULL`.
- **Fix**: Restrict to `authenticated` role.

## M6: blacklist_entries — no per-user scoping
- **Severity**: MEDIUM
- **Tables**: `blacklist_entries`
- **Issue**: Any authenticated user can read/insert/update all blacklist entries (financial data).
- **Fix**: Add ownership column or restrict writes to admin.

## M7: partner_certifications — no ownership on writes
- **Severity**: LOW-MEDIUM
- **Tables**: `partner_certifications`
- **Issue**: INSERT/UPDATE/DELETE only check `auth.uid() IS NOT NULL`.
- **Fix**: Add ownership check via partner relationship.

---

*Filed: 2026-04-14*
