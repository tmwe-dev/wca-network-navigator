/**
 * DAL — prompt_test_cases / prompt_test_runs / prompt_versions.
 *
 * Frontend per la suite di test di regressione dei prompt operativi.
 * Backend: edge function `prompt-test-runner` (vedi docs/audit).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toJsonValue } from "@/lib/jsonGuards";

export interface PromptTestCase {
  id: string;
  prompt_id: string;
  user_id: string;
  name: string;
  description: string | null;
  input_payload: Record<string, unknown>;
  expected_contains: string[];
  expected_not_contains: string[];
  expected_regex: string | null;
  model: string | null;
  temperature: number | null;
  severity: "critical" | "warning" | "info";
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PromptTestRun {
  id: string;
  test_case_id: string;
  prompt_id: string;
  prompt_version_id: string | null;
  user_id: string;
  status: "passed" | "failed" | "error" | "skipped";
  ai_output: string | null;
  failure_reasons: string[];
  model_used: string | null;
  tokens_input: number | null;
  tokens_output: number | null;
  duration_ms: number;
  trigger_source: string | null;
  created_at: string;
  metadata?: Record<string, unknown> | null;
}

export interface PromptVersion {
  id: string;
  prompt_id: string;
  version_number: number;
  name: string;
  context: string | null;
  objective: string | null;
  procedure: string | null;
  criteria: string | null;
  examples: string | null;
  change_reason: string | null;
  created_at: string;
}

function mapTestCaseRow(row: Database["public"]["Tables"]["prompt_test_cases"]["Row"]): PromptTestCase {
  return {
    id: row.id,
    prompt_id: row.prompt_id,
    user_id: row.user_id,
    name: row.name,
    description: row.description,
    input_payload: (typeof row.input_payload === "object" && row.input_payload !== null && !Array.isArray(row.input_payload)
      ? row.input_payload as Record<string, unknown>
      : {}),
    expected_contains: row.expected_contains,
    expected_not_contains: row.expected_not_contains,
    expected_regex: row.expected_regex,
    model: row.model,
    temperature: row.temperature,
    severity: row.severity as PromptTestCase["severity"],
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapTestRunRow(row: Database["public"]["Tables"]["prompt_test_runs"]["Row"]): PromptTestRun {
  return {
    id: row.id,
    test_case_id: row.test_case_id,
    prompt_id: row.prompt_id,
    prompt_version_id: row.prompt_version_id,
    user_id: row.user_id,
    status: row.status as PromptTestRun["status"],
    ai_output: row.ai_output,
    failure_reasons: row.failure_reasons ?? [],
    model_used: row.model_used,
    tokens_input: row.tokens_input,
    tokens_output: row.tokens_output,
    duration_ms: row.duration_ms ?? 0,
    trigger_source: row.trigger_source,
    created_at: row.created_at,
    metadata: null,
  };
}

export async function listTestCasesForPrompt(promptId: string): Promise<PromptTestCase[]> {
  const { data, error } = await supabase
    .from("prompt_test_cases")
    .select("*")
    .eq("prompt_id", promptId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapTestCaseRow);
}

export interface UpsertTestCaseInput {
  id?: string;
  prompt_id: string;
  name: string;
  description?: string | null;
  input_payload: Record<string, unknown>;
  expected_contains?: string[];
  expected_not_contains?: string[];
  expected_regex?: string | null;
  model?: string | null;
  temperature?: number | null;
  severity?: "critical" | "warning" | "info";
  is_active?: boolean;
}

export async function upsertTestCase(input: UpsertTestCaseInput): Promise<PromptTestCase> {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) throw new Error("Not authenticated");

  const row: Database["public"]["Tables"]["prompt_test_cases"]["Insert"] = {
    id: input.id,
    user_id: user.id,
    prompt_id: input.prompt_id,
    name: input.name,
    description: input.description ?? null,
    input_payload: toJsonValue(input.input_payload),
    expected_contains: input.expected_contains ?? [],
    expected_not_contains: input.expected_not_contains ?? [],
    expected_regex: input.expected_regex ?? null,
    model: input.model ?? null,
    temperature: input.temperature ?? null,
    severity: input.severity ?? "warning",
    is_active: input.is_active ?? true,
  };

  const { data, error } = await supabase
    .from("prompt_test_cases")
    .upsert(row, { onConflict: "id" })
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("upsertTestCase: no row returned");
  return mapTestCaseRow(data);
}

export async function deleteTestCase(id: string): Promise<void> {
  const { error } = await supabase.from("prompt_test_cases").delete().eq("id", id);
  if (error) throw error;
}

export async function listRunsForTestCase(testCaseId: string, limit = 20): Promise<PromptTestRun[]> {
  const { data, error } = await supabase
    .from("prompt_test_runs")
    .select("*")
    .eq("test_case_id", testCaseId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(mapTestRunRow);
}

export async function listRunsForPrompt(promptId: string, limit = 50): Promise<PromptTestRun[]> {
  const { data, error } = await supabase
    .from("prompt_test_runs")
    .select("*")
    .eq("prompt_id", promptId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(mapTestRunRow);
}

export interface RunnerSummary {
  total: number;
  passed: number;
  failed: number;
  error: number;
  skipped: number;
}

export interface RunnerResponse {
  runs: PromptTestRun[];
  summary?: RunnerSummary;
  message?: string;
}

export async function runTests(args: {
  test_case_id?: string;
  prompt_id?: string;
  trigger_source?: string;
}): Promise<RunnerResponse> {
  const { invokeAi } = await import("@/lib/ai/invokeAi");
  const data = await invokeAi<RunnerResponse>("prompt-test-runner", {
    scope: "lab",
    body: {
      ...args,
      trigger_source: args.trigger_source ?? "prompt_lab_ui",
    },
    context: { source: "promptTests.runTests", mode: "run-tests" },
  });
  return data;
}

export async function listVersionsForPrompt(promptId: string, limit = 20): Promise<PromptVersion[]> {
  const { data, error } = await supabase
    .from("prompt_versions")
    .select("id, prompt_id, version_number, name, context, objective, procedure, criteria, examples, change_reason, created_at")
    .eq("prompt_id", promptId)
    .order("version_number", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as PromptVersion[];
}

export async function rollbackPromptToVersion(args: {
  promptId: string;
  versionNumber: number;
  reason?: string;
}): Promise<void> {
  const { error } = await supabase.rpc("rollback_prompt_to_version", {
    p_prompt_id: args.promptId,
    p_version_number: args.versionNumber,
    p_reason: args.reason,
  });
  if (error) throw error;
}