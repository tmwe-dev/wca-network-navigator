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

  // 5. Prompt test runner — prompt_test_runs count in last 24h > 0
  checks.prompt_test_runner = await runCheck(async () => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error } = await supabase
      .from("prompt_test_runs")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since);
    if (error) return false;
    return (count ?? 0) > 0;
  });

  // 6. Prompt refiner — ai_pending_actions with action_type='prompt_refinement' not older than 8 days
  checks.prompt_refiner = await runCheck(async () => {
    const since = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const { count, error } = await supabase
      .from("ai_pending_actions")
      .select("id", { count: "exact", head: true })
      .eq("action_type", "prompt_refinement")
      .gte("created_at", since);
    if (error) return false;
    return (count ?? 0) > 0;
  });

  // 7. Funnemail classifier — email_classifications in last 4h > 0
  checks.funnemail_classifier = await runCheck(async () => {
    const since = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    const { count, error } = await supabase
      .from("email_classifications")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since);
    if (error) return false;
    return (count ?? 0) > 0;
  });

  // 8. Pending actions stuck — ai_pending_actions pending > 6h, threshold 10
  checks.pending_actions_stuck = await runCheck(async () => {
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { count, error } = await supabase
      .from("ai_pending_actions")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .lt("created_at", sixHoursAgo);
    if (error) return false;
    return (count ?? 0) < 10;
  });

  // 9. Cron jobs — check pg_cron via RPC or direct query
  checks.cron_jobs = await runCheck(async () => {
    const { data, error } = await supabase.rpc("cron_job_status");
    if (error) {
      // Fallback: if RPC doesn't exist, try raw query approach
      const { data: fallback, error: fbErr } = await supabase
        .from("cron_jobs_view")
        .select("active,last_status")
        .limit(50);
      if (fbErr || !fallback) return false;
      // All must be active with last_status succeeded
      return fallback.every((j: Record<string, unknown>) => j.active && j.last_status === "succeeded");
    }
    if (!data || !Array.isArray(data)) return false;
    return data.every((j: Record<string, unknown>) => j.active && j.last_status === "succeeded");
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
