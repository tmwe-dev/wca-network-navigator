/**
 * DAL — risultati esecuzioni e2e (popolati dal workflow GitHub Actions nightly).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type E2ERunDbRow = Database["public"]["Tables"]["e2e_run_results"]["Row"];

const SPEC_STATUSES = new Set(["passed", "failed", "skipped", "flaky", "timedOut", "interrupted"]);

/** Parser runtime della colonna `spec_results` (Json). */
function parseSpecResults(value: unknown): E2ESpecResult[] {
  if (!Array.isArray(value)) return [];
  const out: E2ESpecResult[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const o = raw as Record<string, unknown>;
    if (typeof o.file !== "string" || typeof o.status !== "string" || !SPEC_STATUSES.has(o.status)) continue;
    out.push({
      file: o.file,
      title: typeof o.title === "string" ? o.title : undefined,
      status: o.status as E2ESpecResult["status"],
      duration_ms: typeof o.duration_ms === "number" ? o.duration_ms : undefined,
      error: typeof o.error === "string" ? o.error : undefined,
    });
  }
  return out;
}

function toE2ERunRow(row: E2ERunDbRow): E2ERunRow {
  return { ...row, spec_results: parseSpecResults(row.spec_results) };
}

export interface E2ESpecResult {
  file: string;
  title?: string;
  status: "passed" | "failed" | "skipped" | "flaky" | "timedOut" | "interrupted";
  duration_ms?: number;
  error?: string;
}

export interface E2ERunRow {
  id: string;
  run_id: string;
  commit_sha: string | null;
  branch: string | null;
  workflow: string;
  started_at: string | null;
  finished_at: string;
  total_tests: number;
  passed: number;
  failed: number;
  skipped: number;
  flaky: number;
  duration_ms: number | null;
  report_url: string | null;
  spec_results: E2ESpecResult[];
  created_at: string;
}

export async function listRecentE2ERuns(limit = 20): Promise<E2ERunRow[]> {
  const { data, error } = await supabase
    .from("e2e_run_results")
    .select("*")
    .order("finished_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(toE2ERunRow);
}

export async function getLatestE2ERun(): Promise<E2ERunRow | null> {
  const { data, error } = await supabase
    .from("e2e_run_results")
    .select("*")
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? toE2ERunRow(data) : null;
}
