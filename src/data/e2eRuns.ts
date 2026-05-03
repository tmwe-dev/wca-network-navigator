/**
 * DAL — risultati esecuzioni e2e (popolati dal workflow GitHub Actions nightly).
 */
import { supabase } from "@/integrations/supabase/client";

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
    .from("e2e_run_results" as never)
    .select("*")
    .order("finished_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as E2ERunRow[];
}

export async function getLatestE2ERun(): Promise<E2ERunRow | null> {
  const { data, error } = await supabase
    .from("e2e_run_results" as never)
    .select("*")
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as E2ERunRow) ?? null;
}