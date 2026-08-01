-- Save scheduler cron secret to Vault and update cron job 37 to send it as x-cron-secret header
DO $$
DECLARE
  v_secret_id uuid;
BEGIN
  SELECT id INTO v_secret_id FROM vault.secrets WHERE name = 'scheduler_cron_secret' LIMIT 1;
  IF v_secret_id IS NULL THEN
    PERFORM vault.create_secret('puntoex_findair@world', 'scheduler_cron_secret', 'Shared secret for smart-scheduler cron auth');
  ELSE
    PERFORM vault.update_secret(v_secret_id, 'puntoex_findair@world', 'scheduler_cron_secret', 'Shared secret for smart-scheduler cron auth');
  END IF;
END $$;

SELECT cron.alter_job(
  job_id := 37,
  command := $cmd$
    SELECT net.http_post(
      url := 'https://zrbditqddhjkutzjycgi.supabase.co/functions/v1/smart-scheduler',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'scheduler_cron_secret' LIMIT 1)
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $cmd$
);