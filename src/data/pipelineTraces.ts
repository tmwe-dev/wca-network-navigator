/**
 * DAL — pipeline_traces
 * Timeline passo-passo delle pipeline (email, contatti, missioni, …).
 * Read-only dalla UI: i record vengono scritti dalle edge function via _shared/pipelineTrace.ts.
 */
import { supabase } from "@/integrations/supabase/client";

export type PipelineTraceStatus = "started" | "success" | "skipped" | "error";

export interface PipelineTraceRow {
  id: string;
  trace_id: string;
  parent_trace_id: string | null;
  entity_type: string;
  entity_id: string | null;
  entity_label: string | null;
  step_name: string;
  step_order: number;
  status: PipelineTraceStatus;
  error_message: string | null;
  input_summary: unknown;
  output_summary: unknown;
  ai_model: string | null;
  ai_scope: string | null;
  duration_ms: number | null;
  operator_id: string | null;
  created_at: string;
}

export interface ListTracesFilters {
  search?: string;
  entityType?: string | "all";
  stepName?: string | "all";
  status?: PipelineTraceStatus | "all";
  traceId?: string;
  entityId?: string;
  from?: string;
  to?: string;
  limit?: number;
}

export async function listPipelineTraces(filters: ListTracesFilters = {}): Promise<PipelineTraceRow[]> {
  let q = supabase.from("pipeline_traces").select("*").order("created_at", { ascending: false }).limit(filters.limit ?? 200);
  if (filters.entityType && filters.entityType !== "all") q = q.eq("entity_type", filters.entityType);
  if (filters.stepName && filters.stepName !== "all") q = q.eq("step_name", filters.stepName);
  if (filters.status && filters.status !== "all") q = q.eq("status", filters.status);
  if (filters.traceId) q = q.eq("trace_id", filters.traceId);
  if (filters.entityId) q = q.eq("entity_id", filters.entityId);
  if (filters.from) q = q.gte("created_at", filters.from);
  if (filters.to) q = q.lte("created_at", filters.to);
  if (filters.search) q = q.or(`entity_label.ilike.%${filters.search}%,step_name.ilike.%${filters.search}%,error_message.ilike.%${filters.search}%`);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as PipelineTraceRow[];
}

export async function getTraceTimeline(traceId: string): Promise<PipelineTraceRow[]> {
  const { data, error } = await supabase
    .from("pipeline_traces")
    .select("*")
    .eq("trace_id", traceId)
    .order("step_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PipelineTraceRow[];
}

export async function listDistinctEntityTypes(): Promise<string[]> {
  const { data, error } = await supabase.from("pipeline_traces").select("entity_type").limit(1000);
  if (error) throw error;
  return Array.from(new Set((data ?? []).map((r) => (r as { entity_type: string }).entity_type))).sort();
}

export async function listDistinctStepNames(): Promise<string[]> {
  const { data, error } = await supabase.from("pipeline_traces").select("step_name").limit(1000);
  if (error) throw error;
  return Array.from(new Set((data ?? []).map((r) => (r as { step_name: string }).step_name))).sort();
}