/**
 * DAL — Funnemail Eval cases & runs (Sprint 5)
 *
 * SCHEMA LIVE: esistono `funnemail_eval_cases` e `funnemail_eval_runs`
 * (case_id / actual_decision / passed / diff / latency_ms / cost_usd / error /
 * run_at). NON esistono `funnemail_eval_batch_runs` né
 * `funnemail_eval_dataset`: le funzioni "dataset + accuracy runs" scritte
 * contro quello schema immaginario sono state rimosse (nessun chiamante di
 * produzione). L'unica superficie ancora referenziata dalla UI —
 * `fetchEvalBatchRuns` — espone il contratto di schema non disponibile.
 */
import { supabase } from "@/integrations/supabase/client";
import { unavailableRead } from "@/data/_shared/unavailableSchema";
import type { Json } from "@/integrations/supabase/types";

/** Narrowing runtime esplicito: converte un Json in Record<string, unknown>. */
function toRecord(json: Json | null | undefined): Record<string, unknown> {
  return typeof json === "object" && json !== null && !Array.isArray(json) ? (json as Record<string, unknown>) : {};
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
  const { data, error } = await supabase
    .from("funnemail_eval_cases")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapEvalCaseRow);
}

export async function listFunnemailEvalRuns(limit = 100): Promise<FunnemailEvalRun[]> {
  const { data, error } = await supabase
    .from("funnemail_eval_runs")
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

/**
 * `funnemail_eval_batch_runs` non esiste nello schema live: nessuna query,
 * la tab Eval mostra lo stato vuoto invece di un errore PostgREST 42P01.
 */
export async function fetchEvalBatchRuns(): Promise<EvalBatchRun[]> {
  return unavailableRead<EvalBatchRun[]>("funnemail_eval_batch_runs", []);
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
