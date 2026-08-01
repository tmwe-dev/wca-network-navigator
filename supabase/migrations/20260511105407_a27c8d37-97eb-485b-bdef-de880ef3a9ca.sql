CREATE OR REPLACE FUNCTION public.prompt_lab_cron_status()
RETURNS TABLE(cron_test_runner boolean, cron_refiner boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, cron
AS $$
  SELECT
    EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'prompt-test-runner-nightly' AND active) AS cron_test_runner,
    EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'agent-prompt-refiner-weekly' AND active) AS cron_refiner;
$$;

REVOKE ALL ON FUNCTION public.prompt_lab_cron_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prompt_lab_cron_status() TO authenticated;