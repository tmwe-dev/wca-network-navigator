/**
 * DAL: ai_test_scenarios + ai-test-runner.
 */
import { supabase } from "@/integrations/supabase/client";
import { invokeAi } from "@/lib/ai/invokeAi";

export interface AiTestAssertion {
  type: "status_ok" | "response_min_length" | "response_contains" | "response_not_contains" | "response_contains_key" | "json_path_equals";
  value?: string | number;
  path?: string;
}

export interface AiTestScenario {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  category: string;
  target_function: string;
  ai_scope: string;
  payload: Record<string, unknown>;
  assertions: AiTestAssertion[];
  tags: string[];
  is_shared: boolean;
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface AiTestRunResult {
  scenario_id: string;
  name: string;
  target_function: string;
  status: "pass" | "fail" | "error";
  http_status: number;
  duration_ms: number;
  failed_assertions: string[];
  response_preview: string;
}

export async function listScenarios(): Promise<AiTestScenario[]> {
  const { data, error } = await supabase
    .from("ai_test_scenarios")
    .select("*")
    .eq("is_active", true)
    .order("category", { ascending: true })
    .order("priority", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as AiTestScenario[];
}

export async function upsertScenario(input: Partial<AiTestScenario>): Promise<AiTestScenario> {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Auth richiesta");
  const row = {
    ...input,
    owner_id: input.owner_id ?? userId,
  };
  const { data, error } = await supabase
    .from("ai_test_scenarios")
    .upsert(row as never)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as unknown as AiTestScenario;
}

export async function deleteScenario(id: string): Promise<void> {
  const { error } = await supabase.from("ai_test_scenarios").delete().eq("id", id);
  if (error) throw error;
}

export async function runScenarios(scenarioIds: string[]): Promise<{ results: AiTestRunResult[]; total: number; passed: number }> {
  return await invokeAi<{ results: AiTestRunResult[]; total: number; passed: number }>("ai-test-runner", {
    scope: "lab",
    context: { source: "AiTestHubPage", route: "/v2/ai-test-hub", mode: "run-scenarios" },
    body: { scenario_ids: scenarioIds },
  });
}