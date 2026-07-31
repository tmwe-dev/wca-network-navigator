/**
 * DAL — super_mario_invocations (osservatorio invocazioni AI Gateway "Super Mario").
 */
import { supabase } from "@/integrations/supabase/client";

export interface SuperMarioInvocationRow {
  id: string;
  trace_id: string;
  scope: string;
  model: string;
  latency_ms: number | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  tool_calls_json: unknown;
  audit_warnings: unknown;
  error_code: string | null;
  created_at: string;
  response_summary: string | null;
}

/** Ultime N invocazioni Super Mario, più recenti prima. */
export async function findRecentSuperMarioInvocations(limit = 20): Promise<SuperMarioInvocationRow[]> {
  const { data, error } = await supabase
    .from("super_mario_invocations")
    .select(
      "id, trace_id, scope, model, latency_ms, prompt_tokens, completion_tokens, tool_calls_json, audit_warnings, error_code, created_at, response_summary",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as SuperMarioInvocationRow[];
}
