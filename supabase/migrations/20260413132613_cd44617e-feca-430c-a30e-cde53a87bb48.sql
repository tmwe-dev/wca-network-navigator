-- Verify email_drafts has strict owner policy (drop legacy if lingering)
DROP POLICY IF EXISTS "auth_email_drafts_all" ON public.email_drafts;
DROP POLICY IF EXISTS "ed_all" ON public.email_drafts;

-- Ensure ed_owner_all exists with strict user_id scoping (no NULL fallback)
DROP POLICY IF EXISTS "ed_owner_all" ON public.email_drafts;
CREATE POLICY "ed_owner_all" ON public.email_drafts
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Document shared tables (these are intentionally accessible to all authenticated users)
COMMENT ON TABLE public.network_configs IS 'Shared WCA network configuration — accessible to all authenticated users (team-wide data, no user_id scope). Pending team_id migration.';
COMMENT ON TABLE public.blacklist_entries IS 'Shared blacklist entries — accessible to all authenticated users for cross-reference during outreach.';
COMMENT ON TABLE public.blacklist_sync_log IS 'Shared blacklist sync log — read-only telemetry for all authenticated users.';
COMMENT ON TABLE public.prospects IS 'Shared prospect data — accessible to all authenticated users. Pending team_id migration.';
COMMENT ON TABLE public.partners_no_contacts IS 'View/table of partners without contacts — shared team reference data.';