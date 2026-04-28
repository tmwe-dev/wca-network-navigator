import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

interface TestRunInsert {
  totalScore: number;
  maxScore: number;
  passCount: number;
  warnCount: number;
  failCount: number;
  summary: Record<string, unknown>;
}

interface TestResultInsert {
  scenarioId: number;
  scenarioName: string;
  endpoint: string;
  status: string;
  score: number;
  durationMs: number;
  issues: string[];
  outputSubject: string;
  outputBody: string;
  debugInfo: Record<string, unknown>;
}

export async function insertTestRun(run: TestRunInsert): Promise<string | null> {
  const { data: { session: __s } } = await supabase.auth.getSession(); const user = __s?.user ?? null;
  if (!user) return null;

  const { data, error } = await supabase
    .from("ai_lab_test_runs")
    .insert([{
      user_id: user.id,
      completed_at: new Date().toISOString(),
      total_score: run.totalScore,
      max_score: run.maxScore,
      pass_count: run.passCount,
      warn_count: run.warnCount,
      fail_count: run.failCount,
      summary: run.summary as Json,
    }])
    .select("id")
    .single();

  if (error) {
    console.error("insertTestRun error:", error);
    return null;
  }
  return data.id;
}

export async function insertTestResults(runId: string, results: TestResultInsert[]): Promise<boolean> {
  const { data: { session: __s } } = await supabase.auth.getSession(); const user = __s?.user ?? null;
  if (!user) return false;

  const rows = results.map((r) => ({
    run_id: runId,
    user_id: user.id,
    scenario_id: r.scenarioId,
    scenario_name: r.scenarioName,
    endpoint: r.endpoint,
    status: r.status,
    score: r.score,
    duration_ms: r.durationMs,
    issues: r.issues as unknown as Json,
    output_subject: r.outputSubject,
    output_body: r.outputBody,
    debug_info: r.debugInfo as unknown as Json,
  }));

  const { error } = await supabase.from("ai_lab_test_results").insert(rows);
  if (error) {
    console.error("insertTestResults error:", error);
    return false;
  }
  return true;
}

export interface TestRunRow {
  id: string;
  started_at: string;
  completed_at: string | null;
  total_score: number;
  max_score: number;
  pass_count: number;
  warn_count: number;
  fail_count: number;
  summary: Record<string, unknown>;
}

export async function fetchRecentRuns(limit = 20): Promise<TestRunRow[]> {
  const { data: { session: __s } } = await supabase.auth.getSession(); const user = __s?.user ?? null;
  if (!user) return [];

  const { data, error } = await supabase
    .from("ai_lab_test_runs")
    .select("id, started_at, completed_at, total_score, max_score, pass_count, warn_count, fail_count, summary")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("fetchRecentRuns error:", error);
    return [];
  }
  return (data ?? []) as TestRunRow[];
}

export interface TestResultRow {
  id: string;
  scenario_id: number;
  scenario_name: string;
  endpoint: string;
  status: string;
  score: number;
  duration_ms: number;
  issues: string[];
  output_subject: string | null;
  output_body: string | null;
  debug_info: Record<string, unknown>;
}

export async function fetchRunResults(runId: string): Promise<TestResultRow[]> {
  const { data, error } = await supabase
    .from("ai_lab_test_results")
    .select("id, scenario_id, scenario_name, endpoint, status, score, duration_ms, issues, output_subject, output_body, debug_info")
    .eq("run_id", runId)
    .order("scenario_id", { ascending: true });

  if (error) {
    console.error("fetchRunResults error:", error);
    return [];
  }
  return (data ?? []) as TestResultRow[];
}

export function exportResultsToCSV(results: TestResultRow[]): string {
  const header = "scenario_id,scenario_name,endpoint,status,score,duration_ms,issues";
  const rows = results.map((r) => {
    const issuesStr = (r.issues || []).join(" | ").replace(/"/g, '""');
    return `${r.scenario_id},"${r.scenario_name}","${r.endpoint}",${r.status},${r.score},${r.duration_ms},"${issuesStr}"`;
  });
  return [header, ...rows].join("\n");
}
