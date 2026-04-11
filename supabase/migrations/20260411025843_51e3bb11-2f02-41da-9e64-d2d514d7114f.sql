
-- Fix ai_request_log: user_id is TEXT, cast auth.uid()
DROP POLICY IF EXISTS "Service inserts" ON public.ai_request_log;
CREATE POLICY "Service inserts" ON public.ai_request_log
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role' OR auth.uid()::text = user_id
  );

-- Fix ai_session_briefings: user_id is UUID
DROP POLICY IF EXISTS "Service inserts" ON public.ai_session_briefings;
CREATE POLICY "Service inserts" ON public.ai_session_briefings
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role' OR auth.uid() = user_id
  );

-- Fix blacklist_sync_log: no user_id, service-only
DROP POLICY IF EXISTS "bsl_insert" ON public.blacklist_sync_log;
CREATE POLICY "bsl_insert" ON public.blacklist_sync_log
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role'
  );

-- Fix partners_no_contacts: authenticated insert
DROP POLICY IF EXISTS "pnc_insert" ON public.partners_no_contacts;
CREATE POLICY "pnc_insert" ON public.partners_no_contacts
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' OR auth.role() = 'service_role'
  );

-- Fix partners_no_contacts: authenticated update
DROP POLICY IF EXISTS "pnc_update" ON public.partners_no_contacts;
CREATE POLICY "pnc_update" ON public.partners_no_contacts
  FOR UPDATE USING (
    auth.role() = 'authenticated' OR auth.role() = 'service_role'
  );

-- Fix request_logs: no user_id, service-only
DROP POLICY IF EXISTS "Service inserts" ON public.request_logs;
CREATE POLICY "Service inserts" ON public.request_logs
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role'
  );

-- Fix voice_call_sessions: user_id is UUID
DROP POLICY IF EXISTS "Service inserts" ON public.voice_call_sessions;
CREATE POLICY "Service inserts" ON public.voice_call_sessions
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role' OR auth.uid() = user_id
  );

DROP POLICY IF EXISTS "Service updates" ON public.voice_call_sessions;
CREATE POLICY "Service updates" ON public.voice_call_sessions
  FOR UPDATE USING (
    auth.role() = 'service_role' OR auth.uid() = user_id
  );
