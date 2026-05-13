/**
 * DAL — Funnemail Eval cases & runs (Sprint 5)
 * Extended in Sprint D with eval dataset + accuracy runs.
 */
import { supabase } from "@/integrations/supabase/client";
import { untypedFrom } from "@/lib/supabaseUntyped";
import { createLogger } from "@/lib/log";

const log = createLogger("funnemailEval");

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

export async function runFunnemailEval(input: {
  case_id?: string;
  tags?: string[];
  all?: boolean;
}): Promise<{ ok: boolean; total?: number; pass_rate?: number; runs?: Array<Record<string, unknown>> }> {
  const { data, error } = await supabase.functions.invoke("run-funnemail-eval", { body: input });
  if (error) throw error;
  return data as { ok: boolean; total?: number; pass_rate?: number };
}

/* ─── Sprint D: Funnemail Eval Dataset & Accuracy Runs ─── */

export interface FunnemailEvalDatasetRow {
  id: string;
  email_subject: string;
  email_body: string;
  expected_category: string;
  expected_intent: string;
  expected_priority: string;
  notes: string | null;
  created_at: string;
  is_active: boolean;
  deleted_at: string | null;
}

export interface FunnemailEvalRunRow {
  id: string;
  run_at: string;
  dataset_size: number;
  category_accuracy: number | null;
  intent_accuracy: number | null;
  priority_accuracy: number | null;
  failures: unknown[];
}

/** Select all active rows from funnemail_eval_dataset */
export async function listEvalDataset(): Promise<FunnemailEvalDatasetRow[]> {
  const { data, error } = await untypedFrom("funnemail_eval_dataset")
    .select("*")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) {
    log.error("listEvalDataset failed", error);
    return [];
  }
  return (data ?? []) as unknown as FunnemailEvalDatasetRow[];
}

/** Insert one row into funnemail_eval_dataset */
export async function insertEvalDatasetRow(input: {
  email_subject: string;
  email_body: string;
  expected_category: string;
  expected_intent: string;
  expected_priority: string;
  notes?: string | null;
}): Promise<FunnemailEvalDatasetRow | null> {
  const { data, error } = await untypedFrom("funnemail_eval_dataset").insert(input).select("*").single();
  if (error) {
    log.error("insertEvalDatasetRow failed", error);
    return null;
  }
  return data as unknown as FunnemailEvalDatasetRow;
}

/** Insert a run result into funnemail_eval_runs */
export async function insertEvalRun(input: {
  dataset_size: number;
  category_accuracy: number | null;
  intent_accuracy: number | null;
  priority_accuracy: number | null;
  failures?: unknown[];
}): Promise<FunnemailEvalRunRow | null> {
  const { data, error } = await untypedFrom("funnemail_eval_runs")
    .insert({ ...input, failures: input.failures ?? [] })
    .select("*")
    .single();
  if (error) {
    log.error("insertEvalRun failed", error);
    return null;
  }
  return data as unknown as FunnemailEvalRunRow;
}

/** List eval runs desc by run_at */
export async function listFunnemailEvalDatasetRuns(limit = 50): Promise<FunnemailEvalRunRow[]> {
  const { data, error } = await untypedFrom("funnemail_eval_runs")
    .select("*")
    .order("run_at", { ascending: false })
    .limit(limit);
  if (error) {
    log.error("listFunnemailEvalDatasetRuns failed", error);
    return [];
  }
  return (data ?? []) as unknown as FunnemailEvalRunRow[];
}

/** Get single run by id */
export async function fetchEvalRunById(runId: string): Promise<FunnemailEvalRunRow | null> {
  const { data, error } = await untypedFrom("funnemail_eval_runs").select("*").eq("id", runId).single();
  if (error) {
    log.error("fetchEvalRunById failed", error);
    return null;
  }
  return data as unknown as FunnemailEvalRunRow;
}
