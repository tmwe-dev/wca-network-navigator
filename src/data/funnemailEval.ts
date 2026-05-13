/**
 * DAL — Funnemail Eval cases & runs (Sprint 5)
 */
import { supabase } from "@/integrations/supabase/client";
import { untypedFrom } from "@/lib/supabaseUntyped";

export interface FunnemailEvalCase {
  id: string;
  name: string;
  description: string | null;
  inbound_payload: Record<string, unknown>;
  expected_decision: Record<string, unknown>;
  tags: string[];
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface FunnemailEvalRun {
  id: string;
  case_id: string;
  prompt_version_id: string | null;
  actual_decision: Record<string, unknown> | null;
  passed: boolean;
  diff: Record<string, unknown> | null;
  latency_ms: number | null;
  cost_usd: number | null;
  error: string | null;
  run_at: string;
}

export async function listFunnemailEvalCases(): Promise<FunnemailEvalCase[]> {
  const { data, error } = await untypedFrom("funnemail_eval_cases")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as FunnemailEvalCase[];
}

export async function listFunnemailEvalRuns(limit = 100): Promise<FunnemailEvalRun[]> {
  const { data, error } = await untypedFrom("funnemail_eval_runs")
    .select("*")
    .order("run_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as FunnemailEvalRun[];
}

export async function createFunnemailEvalCase(payload: {
  name: string;
  inbound_payload: Record<string, unknown>;
  expected_decision: Record<string, unknown>;
  tags?: string[];
}): Promise<void> {
  const { error } = await untypedFrom("funnemail_eval_cases").insert({ ...payload, tags: payload.tags ?? [] });
  if (error) throw error;
}

export interface EvalBatchRun {
  id: string;
  run_at: string;
  dataset_size: number;
  passed_count: number;
  failed_count: number;
  accuracy: number | null;
  prompt_version_id: string | null;
  created_at: string;
}

export async function fetchEvalBatchRuns(): Promise<EvalBatchRun[]> {
  const { data, error } = await untypedFrom("funnemail_eval_batch_runs")
    .select("id, run_at, dataset_size, passed_count, failed_count, accuracy, prompt_version_id, created_at")
    .order("run_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as unknown as EvalBatchRun[];
}

export async function runFunnemailEval(input: { case_id?: string; tags?: string[]; all?: boolean }): Promise<{ ok: boolean; total?: number; pass_rate?: number; runs?: Array<Record<string, unknown>> }> {
  const { data, error } = await supabase.functions.invoke("run-funnemail-eval", { body: input });
  if (error) throw error;
  return data as { ok: boolean; total?: number; pass_rate?: number };
}
