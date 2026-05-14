DROP POLICY IF EXISTS bsl_insert ON public.blacklist_sync_log;
CREATE POLICY bsl_insert_authenticated ON public.blacklist_sync_log
  FOR INSERT TO authenticated
  WITH CHECK (true);