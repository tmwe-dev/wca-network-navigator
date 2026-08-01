
-- 1. Tabella cron_run_log
CREATE TABLE IF NOT EXISTS public.cron_run_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  job_name text NOT NULL,
  ran_at timestamptz NOT NULL DEFAULT now(),
  result jsonb DEFAULT '{}'::jsonb,
  error text
);

CREATE INDEX IF NOT EXISTS idx_cron_run_log_job ON public.cron_run_log (job_name, ran_at DESC);

ALTER TABLE public.cron_run_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cron_run_log_admin_select" ON public.cron_run_log;
CREATE POLICY "cron_run_log_admin_select"
ON public.cron_run_log FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2. Inserimento app_settings
INSERT INTO public.app_settings (key, value, user_id)
VALUES
  ('cron_outreach_scheduler_enabled', 'true', NULL),
  ('cron_outreach_scheduler_interval_min', '5', NULL),
  ('cron_email_sync_enabled', 'true', NULL),
  ('cron_email_sync_interval_min', '15', NULL),
  ('cron_agent_autonomous_enabled', 'false', NULL),
  ('cron_agent_autonomous_interval_min', '10', NULL),
  ('cron_autopilot_worker_enabled', 'true', NULL),
  ('cron_autopilot_worker_interval_min', '30', NULL)
ON CONFLICT (key, user_id) DO NOTHING;

-- 3. Unschedule + reschedule pg_cron in un unico blocco PL/pgSQL
DO $mig$
BEGIN
  BEGIN PERFORM cron.unschedule('outreach_scheduler_tick'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM cron.unschedule('email_cron_sync_tick'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM cron.unschedule('email-sync-worker'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM cron.unschedule('agent_autonomous_cycle_tick'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM cron.unschedule('agent_autopilot_worker_tick'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM cron.unschedule('cron_run_log_cleanup'); EXCEPTION WHEN OTHERS THEN NULL; END;

  PERFORM cron.schedule(
    'outreach_scheduler_tick',
    '*/5 * * * *',
    $cmd$
    SELECT net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/outreach-scheduler',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    );
    $cmd$
  );

  PERFORM cron.schedule(
    'email_cron_sync_tick',
    '*/15 * * * *',
    $cmd$
    SELECT net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/email-cron-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    );
    $cmd$
  );

  PERFORM cron.schedule(
    'agent_autonomous_cycle_tick',
    '*/10 * * * *',
    $cmd$
    SELECT net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/agent-autonomous-cycle',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    );
    $cmd$
  );

  PERFORM cron.schedule(
    'agent_autopilot_worker_tick',
    '*/30 * * * *',
    $cmd$
    SELECT net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/agent-autopilot-worker',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    );
    $cmd$
  );

  PERFORM cron.schedule(
    'cron_run_log_cleanup',
    '0 4 * * *',
    $cmd$DELETE FROM public.cron_run_log WHERE ran_at < now() - interval '7 days'$cmd$
  );
END
$mig$;
