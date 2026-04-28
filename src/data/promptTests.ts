/**
 * DAL — prompt_test_cases / prompt_test_runs / prompt_versions.
 *
 * Frontend per la suite di test di regressione dei prompt operativi.
 * Backend: edge function `prompt-test-runner` (vedi docs/audit).
 */
import { supabase } from "@/integrations/supabase/client";

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

export async function listTestCasesForPrompt(promptId: string): Promise<PromptTestCase[]> {
  const { data, error } = await supabase
    .from("prompt_test_cases")
    .select("*")
    .eq("prompt_id", promptId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as PromptTestCase[];
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

  const row = {
    id: input.id,
    user_id: user.id,
    prompt_id: input.prompt_id,
    name: input.name,
    description: input.description ?? null,
    input_payload: input.input_payload as never,
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
    .upsert(row as never, { onConflict: "id" })
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as unknown as PromptTestCase;
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
  return (data ?? []) as unknown as PromptTestRun[];
}

export async function listRunsForPrompt(promptId: string, limit = 50): Promise<PromptTestRun[]> {
  const { data, error } = await supabase
    .from("prompt_test_runs")
    .select("*")
    .eq("prompt_id", promptId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as PromptTestRun[];
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
  const { data, error } = await supabase.functions.invoke("prompt-test-runner", {
    body: { ...args, trigger_source: args.trigger_source ?? "prompt_lab_ui" },
  });
  if (error) throw error;
  return data as RunnerResponse;
}

export async function listVersionsForPrompt(promptId: string, limit = 20): Promise<PromptVersion[]> {
  const { data, error } = await supabase
    .from("prompt_versions")
    .select("id, prompt_id, version_number, name, context, objective, procedure, criteria, examples, change_reason, created_at")
    .eq("prompt_id", promptId)
    .order("version_number", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as PromptVersion[];
}