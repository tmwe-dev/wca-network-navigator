CREATE OR REPLACE FUNCTION public.cron_job_status()
 RETURNS TABLE(jobname text, schedule text, active boolean, last_run timestamp with time zone, last_status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT
    j.jobname,
    j.schedule,
    j.active,
    d.start_time AS last_run,
    d.status     AS last_status
  FROM cron.job j
  LEFT JOIN LATERAL (
    SELECT start_time, status
    FROM cron.job_run_details
    WHERE jobid = j.jobid
      AND start_time > now() - interval '2 days'
    ORDER BY start_time DESC
    LIMIT 1
  ) d ON true
  ORDER BY j.jobname;
$function$;