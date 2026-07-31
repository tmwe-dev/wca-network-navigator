/**
 * cronGate — kill-switch globale per i cron job automatici.
 *
 * Ogni edge function invocata da pg_cron deve chiamare `assertCronAllowed(admin)`
 * subito dopo l'auth check. Se la flag `system_flags.cron_paused` = true,
 * ritorna una Response 503 da propagare al chiamante (cron skip).
 *
 * Le invocazioni manuali (JWT operatore) NON sono bloccate da questo gate:
 * la pausa serve solo a fermare le trasmissioni automatiche.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "./cors.ts";

/** Lettura minima della flag: permette di condividere la logica senza cast. */
export type CronFlagReader = () => PromiseLike<{ data: Record<string, unknown> | null }>;

/** Implementazione unica del kill-switch, indipendente dal tipo di client. */
export async function isCronPausedWith(read: CronFlagReader): Promise<boolean> {
  try {
    const { data } = await read();
    const raw = data?.value;
    return raw === true || raw === "true";
  } catch {
    // Fail-open: meglio non bloccare per errore di lettura
    return false;
  }
}

export async function isCronPaused(admin: SupabaseClient): Promise<boolean> {
  return isCronPausedWith(() =>
    admin.from("system_flags").select("value").eq("key", "cron_paused").maybeSingle()
  );
}

export async function cronPausedResponse(admin: SupabaseClient, fn: string): Promise<Response | null> {
  if (!(await isCronPaused(admin))) return null;
  console.warn(JSON.stringify({
    level: "warn",
    event: "cron_paused_skip",
    function: fn,
    timestamp: new Date().toISOString(),
  }));
  return new Response(
    JSON.stringify({ skipped: true, reason: "cron_paused", function: fn }),
    { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}