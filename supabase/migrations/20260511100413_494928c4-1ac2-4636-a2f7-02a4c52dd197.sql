-- Espone gli ultimi run di tutti i cron job per il pannello "Automazioni" in top bar
CREATE OR REPLACE FUNCTION public.cron_recent_runs(p_limit integer DEFAULT 30)
RETURNS TABLE(jobid bigint, jobname text, start_time timestamptz, end_time timestamptz, status text, return_message text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public'
AS $$
  SELECT d.jobid, j.jobname, d.start_time, d.end_time, d.status, d.return_message
  FROM cron.job_run_details d
  LEFT JOIN cron.job j ON j.jobid = d.jobid
  ORDER BY d.start_time DESC
  LIMIT GREATEST(1, LEAST(p_limit, 200));
$$;

REVOKE ALL ON FUNCTION public.cron_recent_runs(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cron_recent_runs(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cron_job_status() TO authenticated;