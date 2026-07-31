/**
 * Cron Guard — controlla toggle on/off + throttle dell'intervallo configurato dall'utente
 * e registra l'esito di ogni run nella tabella cron_run_log.
 *
 * Usato dai 4 worker automatici (outreach-scheduler, email-cron-sync,
 * agent-autonomous-cycle, agent-autopilot-worker).
 *
 * Il kill-switch globale `system_flags.cron_paused` NON è reimplementato qui:
 * è l'unica implementazione condivisa in `cronGate.ts` (`isCronPaused`).
 */
import { isCronPaused } from "./cronGate.ts";

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
  | { skip: true; reason: "disabled_by_user" | "throttled" | "cron_paused"; nextInMin?: number };

export async function cronGuardCheck(
  supabase: SupabaseLike,
  config: CronGuardConfig
): Promise<CronGuardResult> {
  // 0. Global kill-switch (system_flags.cron_paused) — implementazione unica in cronGate
  if (await isCronPaused(supabase as never)) {
    console.warn(JSON.stringify({
      level: "warn",
      event: "cron_paused_skip",
      function: config.jobName,
      timestamp: new Date().toISOString(),
    }));
    return { skip: true, reason: "cron_paused" };
  }

  // 1. Toggle
  if ((await readGlobalSetting(supabase, config.enabledKey)) === "false") {
    return { skip: true, reason: "disabled_by_user" };
  }

  // 2. Throttle
  let intervalMin = config.defaultIntervalMin;
  const parsed = parseInt((await readGlobalSetting(supabase, config.intervalKey)) || "", 10);
  if (Number.isFinite(parsed) && parsed > 0) intervalMin = parsed;

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

/** Legge una `app_settings` globale (user_id NULL). Fail-open: null su errore. */
async function readGlobalSetting(supabase: SupabaseLike, key: string): Promise<string | null> {
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", key)
      .is("user_id", null)
      .maybeSingle();
    const value = data?.value;
    return typeof value === "string" ? value : null;
  } catch {
    // se la query fallisce non blocchiamo il run
    return null;
  }
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