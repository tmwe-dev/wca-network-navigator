/**
 * health-check — System health probe with 9 semaphore checks.
 *
 * Returns structured { status, checks, timestamp } consumed by
 * SystemHealthDashboard via useSystemHealth hook.
 *
 * No auth required — exposes only aggregate status, no PII.
 */
import { corsPreflight, getCorsHeaders } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/supabaseClient.ts";

type CheckStatus = "ok" | "fail";
interface CheckResult {
  status: "healthy" | "degraded";
  checks: Record<string, CheckStatus>;
  timestamp: string;
}

async function runCheck(fn: () => Promise<boolean>): Promise<CheckStatus> {
  try {
    return (await fn()) ? "ok" : "fail";
  } catch {
    return "fail";
  }
}

Deno.serve(async (req: Request) => {
  const preflight = corsPreflight(req);
  if (preflight) return preflight;

  const cors = getCorsHeaders(req.headers.get("origin"));
  const supabase = createServiceClient();

  const checks: Record<string, CheckStatus> = {};

  // 1. Database — simple count query
  checks.database = await runCheck(async () => {
    const { error } = await supabase.from("agents").select("id", { count: "exact", head: true });
    return !error;
  });

  // 2. Auth — verify service role can list a single user
  checks.auth = await runCheck(async () => {
    const { error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
    return !error;
  });

  // 3. Storage — list buckets
  checks.storage = await runCheck(async () => {
    const { error } = await supabase.storage.listBuckets();
    return !error;
  });

  // 4. AI Gateway — check env key exists (lightweight)
  checks.ai_gateway = await runCheck(async () => {
    const key = Deno.env.get("LOVABLE_API_KEY") || Deno.env.get("OPENAI_API_KEY") || Deno.env.get("ANTHROPIC_API_KEY");
    return !!key;
  });

  // Helper: stato di un cron job specifico via RPC `cron_job_status`.
  // Considera "ok" un job attivo con last_status='succeeded' o ancora mai
  // eseguito (NULL) — es. job settimanali non ancora arrivati al primo run.
  const cronJobOk = async (jobName: string): Promise<boolean> => {
    const { data, error } = await supabase.rpc("cron_job_status");
    if (error || !Array.isArray(data)) return false;
    const row = (data as Array<Record<string, unknown>>).find((j) => j.jobname === jobName);
    if (!row) return false;
    if (!row.active) return false;
    return row.last_status === "succeeded" || row.last_status == null;
  };

  // 5. Prompt test runner — il cron notturno è andato a buon fine.
  //    (la tabella prompt_test_runs può legittimamente essere vuota se non
  //    ci sono test case attivi: non è un sintomo di health degradato).
  checks.prompt_test_runner = await runCheck(() => cronJobOk("prompt-test-runner-nightly"));

  // 6. Prompt refiner — cron settimanale (lunedì 04:00 UTC). Ok se attivo
  //    e l'ultimo run è 'succeeded' oppure non è ancora mai partito.
  checks.prompt_refiner = await runCheck(() => cronJobOk("agent-prompt-refiner-weekly"));

  // 7. Funnemail classifier — la pipeline scrive su `reply_classifications`
  //    (NON su `email_classifications`, che è una tabella legacy). In più
  //    teniamo come fallback lo stato del cron di batch.
  checks.funnemail_classifier = await runCheck(async () => {
    const since = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    const { count, error } = await supabase
      .from("reply_classifications")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since);
    if (!error && (count ?? 0) > 0) return true;
    // Fallback: il cron di classifica gira ed è 'succeeded'
    return cronJobOk("classify-emails-batch-every-5min");
  });

  // 8. Pending actions stuck — ai_pending_actions pending > 6h.
  //    Soglia alzata a 100 (uso interno, batch content_intel possono
  //    accumularsi senza essere bloccanti).
  checks.pending_actions_stuck = await runCheck(async () => {
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { count, error } = await supabase
      .from("ai_pending_actions")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .lt("created_at", sixHoursAgo);
    if (error) return false;
    return (count ?? 0) < 100;
  });

  // 9. Cron jobs — ok se TUTTI i job attivi sono 'succeeded' oppure mai
  //    eseguiti (NULL). Job 'failed' fanno fallire il check.
  checks.cron_jobs = await runCheck(async () => {
    const { data, error } = await supabase.rpc("cron_job_status");
    if (error || !Array.isArray(data)) return false;
    return (data as Array<Record<string, unknown>>).every(
      (j) => j.active && (j.last_status === "succeeded" || j.last_status == null),
    );
  });

  // Overall status
  const allOk = Object.values(checks).every((s) => s === "ok");
  const result: CheckResult = {
    status: allOk ? "healthy" : "degraded",
    checks,
    timestamp: new Date().toISOString(),
  };

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
});
