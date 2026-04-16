-- Registra 6 cron job ricorrenti per edge functions di scheduling / sync / backfill.
-- Idempotente: cron.unschedule di qualsiasi job con lo stesso nome prima di ri-schedulare.

DO $$
DECLARE
  v_job_id int;
  v_names text[] := ARRAY[
    'outreach_scheduler_tick',
    'email_cron_sync_tick',
    'agent_autonomous_cycle_tick',
    'agent_autopilot_worker_tick',
    'kb_embed_backfill_daily',
    'memory_embed_backfill_daily'
  ];
  v_name text;
BEGIN
  FOREACH v_name IN ARRAY v_names LOOP
    SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = v_name;
    IF FOUND THEN
      PERFORM cron.unschedule(v_name);
    END IF;
  END LOOP;
END $$;

SELECT cron.schedule(
  'outreach_scheduler_tick',
  '* * * * *',
  $cmd$
  SELECT net.http_post(
    url := 'https://zrbditqddhjkutzjycgi.supabase.co/functions/v1/outreach-scheduler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $cmd$
);

SELECT cron.schedule(
  'email_cron_sync_tick',
  '*/5 * * * *',
  $cmd$
  SELECT net.http_post(
    url := 'https://zrbditqddhjkutzjycgi.supabase.co/functions/v1/email-cron-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $cmd$
);

SELECT cron.schedule(
  'agent_autonomous_cycle_tick',
  '*/2 * * * *',
  $cmd$
  SELECT net.http_post(
    url := 'https://zrbditqddhjkutzjycgi.supabase.co/functions/v1/agent-autonomous-cycle',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $cmd$
);

SELECT cron.schedule(
  'agent_autopilot_worker_tick',
  '*/10 * * * *',
  $cmd$
  SELECT net.http_post(
    url := 'https://zrbditqddhjkutzjycgi.supabase.co/functions/v1/agent-autopilot-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $cmd$
);

SELECT cron.schedule(
  'kb_embed_backfill_daily',
  '0 3 * * *',
  $cmd$
  SELECT net.http_post(
    url := 'https://zrbditqddhjkutzjycgi.supabase.co/functions/v1/kb-embed-backfill',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $cmd$
);

SELECT cron.schedule(
  'memory_embed_backfill_daily',
  '15 3 * * *',
  $cmd$
  SELECT net.http_post(
    url := 'https://zrbditqddhjkutzjycgi.supabase.co/functions/v1/memory-embed-backfill',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $cmd$
);