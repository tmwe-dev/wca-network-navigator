-- Fix RLS: replace permissive (true) policies with authenticated/scoped access

-- 1. blacklist_entries: SELECT was USING (true) → restrict to authenticated
DROP POLICY IF EXISTS "bl_auth_select" ON blacklist_entries;
CREATE POLICY "bl_auth_select" ON blacklist_entries
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- 2. blacklist_sync_log: SELECT was USING (true) → restrict to authenticated
DROP POLICY IF EXISTS "bsl_select" ON blacklist_sync_log;
CREATE POLICY "bsl_select" ON blacklist_sync_log
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- 3. partners_no_contacts: SELECT was USING (true) → restrict to authenticated
DROP POLICY IF EXISTS "pnc_select" ON partners_no_contacts;
CREATE POLICY "pnc_select" ON partners_no_contacts
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- 4. supervisor_audit_log: INSERT had WITH CHECK (true) → restrict to service_role only
DROP POLICY IF EXISTS "Service role inserts audit" ON supervisor_audit_log;
CREATE POLICY "service_role_inserts_audit" ON supervisor_audit_log
  FOR INSERT TO service_role
  WITH CHECK (true);