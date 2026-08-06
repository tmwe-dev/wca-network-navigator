/**
 * report-classify-dedup.ts — Baseline B0.
 *
 * Interroga pipeline_traces degli ultimi 7 giorni e stampa un breakdown
 * per source_hint (check-inbox-postProcess | cron-batch | unknown = trigger DB)
 * di quante invocazioni classify-inbound-message hanno colpito il ramo
 * dedup (message_id già in reply_classifications).
 *
 * Usage: deno run -A scripts/report-classify-dedup.ts
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 *
 * NON scrive nulla. Baseline per autorizzare Batch B2 (rimozione fallback).
 */

// deno-lint-ignore-file no-console
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

interface TraceRow {
  trace_id: string;
  step_name: string;
  output_summary: Record<string, unknown> | null;
}

const { data, error } = await supabase
  .from("pipeline_traces")
  .select("trace_id, step_name, output_summary")
  .gte("created_at", sinceIso)
  .in("step_name", ["classify_inbound:received", "classify_inbound:dedup_hit"])
  .limit(50000);

if (error) {
  console.error("Query error:", error.message);
  Deno.exit(2);
}

const rows = (data ?? []) as TraceRow[];
const bySource = new Map<string, { received: Set<string>; dedup: number }>();

for (const r of rows) {
  const src = String((r.output_summary as Record<string, unknown> | null)?.source_hint ?? "unknown");
  const bucket = bySource.get(src) ?? { received: new Set<string>(), dedup: 0 };
  if (r.step_name === "classify_inbound:received") bucket.received.add(r.trace_id);
  if (r.step_name === "classify_inbound:dedup_hit") bucket.dedup += 1;
  bySource.set(src, bucket);
}

console.log("=== classify-inbound-message · last 7d ===");
console.log("since:", sinceIso);
console.log("");
console.log("source_hint            | invocations | dedup_hits | unique_messages");
console.log("-----------------------|-------------|------------|-----------------");
for (const [src, b] of bySource.entries()) {
  const pad = (s: string | number, n: number) => String(s).padEnd(n, " ");
  console.log(`${pad(src, 22)} | ${pad(b.received.size, 11)} | ${pad(b.dedup, 10)} | ${pad(b.received.size, 15)}`);
}
console.log("");
console.log("Legenda source_hint:");
console.log("  check-inbox-postProcess = fallback rete in check-inbox");
console.log("  cron-batch              = classify-emails-batch (safety net 5m)");
console.log("  unknown                 = trigger DB on_inbound_message (pg_net)");
