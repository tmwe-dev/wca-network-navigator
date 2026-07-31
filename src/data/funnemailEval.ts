/**
 * DAL — Funnemail Eval cases & runs (Sprint 5)
 * Extended in Sprint D with eval dataset + accuracy runs.
 *
 * DRIFT: `funnemail_eval_dataset` e `funnemail_eval_batch_runs` non esistono
 * nei tipi generati (src/integrations/supabase/types.ts) — restano su
 * `untypedFrom` con cast espliciti finché i tipi non vengono rigenerati.
 */
import { supabase } from "@/integrations/supabase/client";
import { untypedFrom } from "@/lib/supabaseUntyped";
import { createLogger } from "@/lib/log";
import type { Json } from "@/integrations/supabase/types";

const log = createLogger("funnemailEval");

/** Narrowing runtime esplicito: converte un Json in Record<string, unknown>. */
function toRecord(json: Json | null | undefined): Record<string, unknown> {
  return typeof json === "object" && json !== null && !Array.isArray(json)
    ? (json as Record<string, unknown>)
    : {};
}

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

function mapEvalCaseRow(row: {
  id: string;
  name: string;
  description: string | null;
  inbound_payload: Json;
  expected_decision: Json;
  tags: string[];
  enabled: boolean;
  created_at: string;
  updated_at: string;
}): FunnemailEvalCase {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    inbound_payload: toRecord(row.inbound_payload),
    expected_decision: toRecord(row.expected_decision),
    tags: row.tags,
    enabled: row.enabled,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapEvalRunRow(row: {
  id: string;
  case_id: string;
  prompt_version_id: string | null;
  actual_decision: Json | null;
  passed: boolean;
  diff: Json | null;
  latency_ms: number | null;
  cost_usd: number | null;
  error: string | null;
  run_at: string;
}): FunnemailEvalRun {
  return {
    id: row.id,
    case_id: row.case_id,
    prompt_version_id: row.prompt_version_id,
    actual_decision: row.actual_decision == null ? null : toRecord(row.actual_decision),
    passed: row.passed,
    diff: row.diff == null ? null : toRecord(row.diff),
    latency_ms: row.latency_ms,
    cost_usd: row.cost_usd,
    error: row.error,
    run_at: row.run_at,
  };
}

export async function listFunnemailEvalCases(): Promise<FunnemailEvalCase[]> {
  const { data, error } = await supabase.from("funnemail_eval_cases")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapEvalCaseRow);
}

export async function listFunnemailEvalRuns(limit = 100): Promise<FunnemailEvalRun[]> {
  const { data, error } = await supabase.from("funnemail_eval_runs")
    .select("*")
    .order("run_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(mapEvalRunRow);
}

export async function createFunnemailEvalCase(payload: {
  name: string;
  inbound_payload: Record<string, unknown>;
  expected_decision: Record<string, unknown>;
  tags?: string[];
}): Promise<void> {
  const { error } = await supabase.from("funnemail_eval_cases").insert({
    name: payload.name,
    inbound_payload: payload.inbound_payload as Json,
    expected_decision: payload.expected_decision as Json,
    tags: payload.tags ?? [],
  });
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

/** DRIFT: `funnemail_eval_batch_runs` non è presente nei tipi generati. */
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

/**
 * DRIFT: `funnemail_eval_dataset` non è presente nei tipi generati — resta
 * su `untypedFrom` con cast espliciti.
 */
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

/** DRIFT: `funnemail_eval_dataset` non è presente nei tipi generati. */
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

/**
 * NOTA: questa insert scrive colonne (`dataset_size`, `category_accuracy`,
 * `intent_accuracy`, `priority_accuracy`, `failures`) che appartengono allo
 * schema logico "eval dataset runs" ma la tabella fisica tipizzata
 * `funnemail_eval_runs` (vedi sopra, Sprint 5) ha uno schema diverso
 * (`case_id`, `actual_decision`, `passed`, `diff`, ...). Le due funzioni
 * condividono il nome tabella ma non lo schema: mantenuto untyped per non
 * introdurre falsi positivi di compatibilità.
 */
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

/** List eval runs desc by run_at (NOTA: vedi drift sopra su insertEvalRun). */
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

/** Get single run by id (NOTA: vedi drift sopra su insertEvalRun). */
export async function fetchEvalRunById(runId: string): Promise<FunnemailEvalRunRow | null> {
  const { data, error } = await untypedFrom("funnemail_eval_runs").select("*").eq("id", runId).single();
  if (error) {
    log.error("fetchEvalRunById failed", error);
    return null;
  }
  return data as unknown as FunnemailEvalRunRow;
}
