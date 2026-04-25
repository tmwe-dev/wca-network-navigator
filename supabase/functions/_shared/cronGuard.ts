/**
 * Cron Guard — controlla toggle on/off + throttle dell'intervallo configurato dall'utente
 * e registra l'esito di ogni run nella tabella cron_run_log.
 *
 * Usato dai 4 worker automatici (outreach-scheduler, email-cron-sync,
 * agent-autonomous-cycle, agent-autopilot-worker).
 */

// Generic supabase-js client interface (avoids type imports across deno boundary)
interface SupabaseLike {
  from: (table: string) => any;
}

export interface CronGuardConfig {
  /** Job key in cron_run_log (es: "outreach_scheduler"). */
  jobName: string;
  /** app_settings key per il toggle on/off. */
  enabledKey: string;
  /** app_settings key per l'intervallo in minuti. */
  intervalKey: string;
  /** Default in minuti se la setting non esiste. */
  defaultIntervalMin: number;
}

export type CronGuardResult =
  | { skip: false }
  | { skip: true; reason: "disabled_by_user" | "throttled"; nextInMin?: number };

export async function cronGuardCheck(
  supabase: SupabaseLike,
  config: CronGuardConfig
): Promise<CronGuardResult> {
  // 1. Toggle
  try {
    const { data: enabledRow } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", config.enabledKey)
      .is("user_id", null)
      .maybeSingle();
    if (enabledRow?.value === "false") {
      return { skip: true, reason: "disabled_by_user" };
    }
  } catch {
    // se la query fallisce non blocchiamo il run
  }

  // 2. Throttle
  let intervalMin = config.defaultIntervalMin;
  try {
    const { data: intervalRow } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", config.intervalKey)
      .is("user_id", null)
      .maybeSingle();
    const parsed = parseInt(intervalRow?.value || "", 10);
    if (Number.isFinite(parsed) && parsed > 0) intervalMin = parsed;
  } catch {
    // ignore
  }

  try {
    const { data: lastRun } = await supabase
      .from("cron_run_log")
      .select("ran_at")
      .eq("job_name", config.jobName)
      .order("ran_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastRun?.ran_at) {
      const elapsedMin = (Date.now() - new Date(lastRun.ran_at).getTime()) / 60000;
      if (elapsedMin < intervalMin) {
        return { skip: true, reason: "throttled", nextInMin: Math.ceil(intervalMin - elapsedMin) };
      }
    }
  } catch {
    // ignore
  }

  return { skip: false };
}

export async function cronGuardLogRun(
  supabase: SupabaseLike,
  jobName: string,
  result: Record<string, unknown> = {},
  error?: string | null
): Promise<void> {
  try {
    await supabase.from("cron_run_log").insert({
      job_name: jobName,
      ran_at: new Date().toISOString(),
      result,
      error: error ?? null,
    });
  } catch {
    // logging best-effort
  }
}