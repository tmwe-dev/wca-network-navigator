/**
 * record-e2e-run
 * Webhook chiamato dal workflow GitHub Actions `e2e-nightly`
 * per archiviare il riepilogo del run.
 *
 * Auth: header `x-e2e-secret` deve corrispondere alla env E2E_WEBHOOK_SECRET.
 * Nessun JWT: il workflow non ha sessione utente.
 */
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-e2e-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SpecResult {
  file: string;
  title?: string;
  status: string;
  duration_ms?: number;
  error?: string;
}

interface Payload {
  run_id: string;
  commit_sha?: string;
  branch?: string;
  workflow?: string;
  started_at?: string;
  finished_at?: string;
  total_tests: number;
  passed: number;
  failed: number;
  skipped: number;
  flaky?: number;
  duration_ms?: number;
  report_url?: string;
  spec_results?: SpecResult[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const expected = Deno.env.get("E2E_WEBHOOK_SECRET");
  if (!expected) {
    return new Response(JSON.stringify({ error: "webhook secret not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const provided = req.headers.get("x-e2e-secret");
  if (provided !== expected) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: Payload;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!body.run_id || typeof body.total_tests !== "number") {
    return new Response(JSON.stringify({ error: "missing required fields: run_id, total_tests" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error } = await supabase
    .from("e2e_run_results")
    .insert({
      run_id: body.run_id,
      commit_sha: body.commit_sha ?? null,
      branch: body.branch ?? null,
      workflow: body.workflow ?? "e2e-nightly",
      started_at: body.started_at ?? null,
      finished_at: body.finished_at ?? new Date().toISOString(),
      total_tests: body.total_tests,
      passed: body.passed ?? 0,
      failed: body.failed ?? 0,
      skipped: body.skipped ?? 0,
      flaky: body.flaky ?? 0,
      duration_ms: body.duration_ms ?? null,
      report_url: body.report_url ?? null,
      spec_results: body.spec_results ?? [],
    })
    .select("id")
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, id: data?.id }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});