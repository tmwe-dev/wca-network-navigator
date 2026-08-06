/**
 * DAL — app_settings globali (user_id null) + cron_run_log, per il pannello
 * di controllo dei processi automatici.
 */
import { supabase } from "@/integrations/supabase/client";

export interface GlobalSettingRow {
  key: string;
  value: string | null;
}

/** app_settings globali (user_id IS NULL) per un set di chiavi. */
export async function findGlobalSettings(keys: string[]): Promise<GlobalSettingRow[]> {
  const { data } = await supabase.from("app_settings").select("key, value").is("user_id", null).in("key", keys);
  return data ?? [];
}

export interface CronRunLogRow {
  job_name: string;
  ran_at: string;
  error: string | null;
}

/** Log delle esecuzioni cron per un set di job, da una data in poi. */
export async function findCronRunLogs(jobNames: string[], sinceIso: string): Promise<CronRunLogRow[]> {
  const { data } = await supabase
    .from("cron_run_log")
    .select("job_name, ran_at, error")
    .in("job_name", jobNames)
    .gte("ran_at", sinceIso)
    .order("ran_at", { ascending: false });
  return (data as CronRunLogRow[]) ?? [];
}

/** Upsert di un'app_setting globale (user_id null). */
export async function upsertGlobalSetting(key: string, value: string): Promise<void> {
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key, value, user_id: null }, { onConflict: "key,user_id" });
  if (error) throw error;
}
