
-- Drop existing policies on channel_messages
DROP POLICY IF EXISTS "Users manage own channel_messages" ON public.channel_messages;

-- Separate policies for channel_messages: admin sees all, normal user sees own
CREATE POLICY "cm_select" ON public.channel_messages
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_operator_admin());

CREATE POLICY "cm_insert" ON public.channel_messages
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "cm_update" ON public.channel_messages
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "cm_delete" ON public.channel_messages
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Drop existing policies on campaign_jobs
DROP POLICY IF EXISTS "campaign_jobs_select" ON public.campaign_jobs;
DROP POLICY IF EXISTS "campaign_jobs_insert" ON public.campaign_jobs;
DROP POLICY IF EXISTS "campaign_jobs_update" ON public.campaign_jobs;
DROP POLICY IF EXISTS "campaign_jobs_delete" ON public.campaign_jobs;

-- Admin sees all campaign_jobs, normal user sees own
CREATE POLICY "cj_select" ON public.campaign_jobs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_operator_admin());

CREATE POLICY "cj_insert" ON public.campaign_jobs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "cj_update" ON public.campaign_jobs
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_operator_admin());

CREATE POLICY "cj_delete" ON public.campaign_jobs
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());
