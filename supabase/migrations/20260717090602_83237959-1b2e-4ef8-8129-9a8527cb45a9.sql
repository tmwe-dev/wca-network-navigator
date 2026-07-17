CREATE OR REPLACE FUNCTION public.cron_job_status()
 RETURNS TABLE(jobname text, schedule text, active boolean, last_run timestamp with time zone, last_status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  WITH recent AS (
    SELECT DISTINCT ON (jobid)
      jobid, start_time, status
    FROM cron.job_run_details
    WHERE start_time > now() - interval '1 day'
    ORDER BY jobid, start_time DESC
  )
  SELECT
    j.jobname,
    j.schedule,
    j.active,
    r.start_time AS last_run,
    r.status     AS last_status
  FROM cron.job j
  LEFT JOIN recent r ON r.jobid = j.jobid
  ORDER BY j.jobname;
$function$;