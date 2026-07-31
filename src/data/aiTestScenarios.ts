/**
 * DAL: ai_test_scenarios + ai-test-runner.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { invokeAi } from "@/lib/ai/invokeAi";
import { asJsonObject, toJsonValue } from "@/lib/typedJson";

type ScenarioRow = Database["public"]["Tables"]["ai_test_scenarios"]["Row"];

const ASSERTION_TYPES = new Set([
  "status_ok",
  "response_min_length",
  "response_contains",
  "response_not_contains",
  "response_contains_key",
  "json_path_equals",
]);

/** Parser runtime delle assertion salvate come colonna `Json`. */
function parseAssertions(value: unknown): AiTestAssertion[] {
  if (!Array.isArray(value)) return [];
  const out: AiTestAssertion[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const obj = raw as Record<string, unknown>;
    if (typeof obj.type !== "string" || !ASSERTION_TYPES.has(obj.type)) continue;
    out.push({
      type: obj.type as AiTestAssertion["type"],
      value: typeof obj.value === "string" || typeof obj.value === "number" ? obj.value : undefined,
      path: typeof obj.path === "string" ? obj.path : undefined,
    });
  }
  return out;
}

function toScenario(row: ScenarioRow): AiTestScenario {
  return {
    id: row.id,
    owner_id: row.owner_id,
    name: row.name,
    description: row.description,
    category: row.category,
    target_function: row.target_function,
    ai_scope: row.ai_scope,
    payload: asJsonObject(row.payload),
    assertions: parseAssertions(row.assertions),
    tags: Array.isArray(row.tags) ? row.tags : [],
    is_shared: row.is_shared,
    is_active: row.is_active,
    priority: row.priority,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

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
  return (data ?? []).map(toScenario);
}

export async function upsertScenario(input: Partial<AiTestScenario>): Promise<AiTestScenario> {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Auth richiesta");
  const row: Database["public"]["Tables"]["ai_test_scenarios"]["Insert"] = {
    ...input,
    owner_id: input.owner_id ?? userId,
    name: input.name ?? "",
    target_function: input.target_function ?? "",
    payload: input.payload === undefined ? undefined : toJsonValue(input.payload),
    assertions: input.assertions === undefined ? undefined : toJsonValue(input.assertions),
  };
  const { data, error } = await supabase
    .from("ai_test_scenarios")
    .upsert(row)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Upsert scenario: nessuna riga restituita");
  return toScenario(data);
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