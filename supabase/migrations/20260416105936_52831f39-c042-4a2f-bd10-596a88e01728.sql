-- Rimuove 4 cron job hyphen-named duplicati, rimpiazzati da underscore-named in migration 20260416104627.
-- Lista esatta da disattivare (non toccare altri job):
--   outreach-scheduler        → duplicato di outreach_scheduler_tick
--   email-cron-sync           → duplicato di email_cron_sync_tick
--   agent-autonomous-cycle    → duplicato di agent_autonomous_cycle_tick
--   agent-autopilot-worker    → duplicato di agent_autopilot_worker_tick
-- Idempotente: unschedule solo se esiste.

DO $$
DECLARE
  v_duplicates text[] := ARRAY[
    'outreach-scheduler',
    'email-cron-sync',
    'agent-autonomous-cycle',
    'agent-autopilot-worker'
  ];
  v_name text;
  v_exists boolean;
BEGIN
  FOREACH v_name IN ARRAY v_duplicates LOOP
    SELECT EXISTS (SELECT 1 FROM cron.job WHERE jobname = v_name) INTO v_exists;
    IF v_exists THEN
      PERFORM cron.unschedule(v_name);
      RAISE NOTICE 'Unscheduled duplicate cron job: %', v_name;
    ELSE
      RAISE NOTICE 'Cron job % not found, skipping', v_name;
    END IF;
  END LOOP;
END $$;