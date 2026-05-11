/**
 * DAL: cron jobs (pg_cron) — letture per il pannello "Automazioni" in top bar.
 * Read-only via funzioni SECURITY DEFINER `cron_job_status()` e `cron_recent_runs(limit)`.
 */
import { supabase } from "@/integrations/supabase/client";

export interface CronJobStatus {
  jobname: string;
  schedule: string;
  active: boolean;
  last_run: string | null;
  last_status: string | null;
}

export interface CronRunRow {
  jobid: number;
  jobname: string | null;
  start_time: string;
  end_time: string | null;
  status: string;
  return_message: string | null;
}

export async function listCronJobStatus(): Promise<CronJobStatus[]> {
  const { data, error } = await supabase.rpc("cron_job_status" as never);
  if (error) return [];
  return (data as unknown as CronJobStatus[]) ?? [];
}

export async function listCronRecentRuns(limit = 30): Promise<CronRunRow[]> {
  const { data, error } = await supabase.rpc("cron_recent_runs" as never, { p_limit: limit } as never);
  if (error) return [];
  return (data as unknown as CronRunRow[]) ?? [];
}