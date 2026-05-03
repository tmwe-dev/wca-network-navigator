#!/usr/bin/env node
/**
 * Legge playwright-results.json e POSTa il riepilogo all'edge function
 * `record-e2e-run` cosicché compaia sulla pagina /v2/settings/e2e-status.
 *
 * Env richieste (impostate dal workflow GitHub Actions):
 *  - SUPABASE_URL                 (es. https://zrbditqddhjkutzjycgi.supabase.co)
 *  - E2E_WEBHOOK_SECRET           (header x-e2e-secret)
 *  - GITHUB_RUN_ID, GITHUB_SHA, GITHUB_REF_NAME, GITHUB_SERVER_URL, GITHUB_REPOSITORY
 */
import { readFileSync, existsSync } from "node:fs";

const RESULTS = process.env.PLAYWRIGHT_JSON_OUTPUT_NAME || "playwright-results.json";
const WEBHOOK_SECRET = process.env.E2E_WEBHOOK_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;

if (!WEBHOOK_SECRET) {
  console.warn("[post-e2e-results] E2E_WEBHOOK_SECRET mancante, skip upload");
  process.exit(0);
}
if (!SUPABASE_URL) {
  console.warn("[post-e2e-results] SUPABASE_URL mancante, skip upload");
  process.exit(0);
}
if (!existsSync(RESULTS)) {
  console.warn(`[post-e2e-results] file ${RESULTS} non trovato, skip`);
  process.exit(0);
}

const raw = JSON.parse(readFileSync(RESULTS, "utf8"));

let total = 0, passed = 0, failed = 0, skipped = 0, flaky = 0;
const specs = [];

function walkSuite(suite, parentFile) {
  const file = suite.file || parentFile || "";
  for (const spec of suite.specs ?? []) {
    for (const t of spec.tests ?? []) {
      total++;
      const result = t.results?.[t.results.length - 1];
      const status = result?.status || "unknown";
      const duration = result?.duration ?? 0;
      if (status === "passed") passed++;
      else if (status === "failed" || status === "timedOut") failed++;
      else if (status === "skipped") skipped++;
      if ((t.results?.length ?? 0) > 1 && status === "passed") flaky++;
      specs.push({
        file,
        title: spec.title,
        status,
        duration_ms: Math.round(duration),
        error: result?.error?.message?.slice(0, 500),
      });
    }
  }
  for (const sub of suite.suites ?? []) walkSuite(sub, file);
}

for (const s of raw.suites ?? []) walkSuite(s, s.file);

const runId = process.env.GITHUB_RUN_ID || `local-${Date.now()}`;
const sha = process.env.GITHUB_SHA;
const branch = process.env.GITHUB_REF_NAME;
const reportUrl = process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY
  ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${runId}`
  : undefined;

const payload = {
  run_id: String(runId),
  commit_sha: sha,
  branch,
  workflow: process.env.GITHUB_WORKFLOW || "e2e-nightly",
  started_at: raw.config?.metadata?.startTime || raw.stats?.startTime,
  finished_at: new Date().toISOString(),
  total_tests: total,
  passed,
  failed,
  skipped,
  flaky,
  duration_ms: raw.stats?.duration ? Math.round(raw.stats.duration) : undefined,
  report_url: reportUrl,
  spec_results: specs,
};

const url = `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/record-e2e-run`;
const res = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-e2e-secret": WEBHOOK_SECRET,
  },
  body: JSON.stringify(payload),
});
const text = await res.text();
if (!res.ok) {
  console.error(`[post-e2e-results] errore ${res.status}:`, text);
  process.exit(1);
}
console.log(`[post-e2e-results] OK: ${passed}/${total} passed, ${failed} failed, run_id=${runId}`);