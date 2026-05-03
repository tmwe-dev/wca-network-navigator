-- Agents: visibilità globale per operatori autenticati
DROP POLICY IF EXISTS agents_select_own ON public.agents;
CREATE POLICY agents_select_all_authenticated
  ON public.agents FOR SELECT
  TO authenticated
  USING (true);

-- Cestinone queues: visibilità globale (uso interno aziendale)
DROP POLICY IF EXISTS email_campaign_queue_select_own ON public.email_campaign_queue;
CREATE POLICY email_campaign_queue_select_all_authenticated
  ON public.email_campaign_queue FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS cockpit_queue_select_own ON public.cockpit_queue;
CREATE POLICY cockpit_queue_select_all_authenticated
  ON public.cockpit_queue FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS outreach_queue_select_own ON public.outreach_queue;
CREATE POLICY outreach_queue_select_all_authenticated
  ON public.outreach_queue FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS campaign_jobs_select_own ON public.campaign_jobs;
CREATE POLICY campaign_jobs_select_all_authenticated
  ON public.campaign_jobs FOR SELECT
  TO authenticated
  USING (true);