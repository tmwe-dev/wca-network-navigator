/**
 * pipelineTrace — Helper per emettere step di una pipeline su `pipeline_traces`.
 *
 * Uso (dentro un'edge function):
 *   const tracer = createTracer(supabase, { traceId, entityType: 'email', entityId, entityLabel });
 *   await tracer.step('classify_inbound', { input: {...}, output: {...}, status: 'success', durationMs });
 *
 * Fail-safe: ogni errore viene swallowed, mai blocca la pipeline reale.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type TraceStatus = "started" | "success" | "skipped" | "error";

export interface TraceContext {
  traceId: string;
  parentTraceId?: string | null;
  entityType: string;
  entityId?: string | null;
  entityLabel?: string | null;
  operatorId?: string | null;
}

export interface TraceStepInput {
  input?: unknown;
  output?: unknown;
  status?: TraceStatus;
  errorMessage?: string | null;
  aiModel?: string | null;
  aiScope?: string | null;
  durationMs?: number | null;
  order?: number;
}

function summarize(value: unknown, maxLen = 1500): unknown {
  if (value == null) return null;
  try {
    const str = typeof value === "string" ? value : JSON.stringify(value);
    if (str.length <= maxLen) return value;
    return { _truncated: true, preview: str.slice(0, maxLen) };
  } catch {
    return { _unserializable: true };
  }
}

export function createTracer(supabase: SupabaseClient, ctx: TraceContext) {
  let order = 0;
  return {
    traceId: ctx.traceId,
    async step(stepName: string, input: TraceStepInput = {}): Promise<void> {
      try {
        order = input.order ?? order + 1;
        await supabase.from("pipeline_traces").insert({
          trace_id: ctx.traceId,
          parent_trace_id: ctx.parentTraceId ?? null,
          entity_type: ctx.entityType,
          entity_id: ctx.entityId ?? null,
          entity_label: ctx.entityLabel ?? null,
          step_name: stepName,
          step_order: order,
          status: input.status ?? "success",
          error_message: input.errorMessage ?? null,
          input_summary: summarize(input.input) as never,
          output_summary: summarize(input.output) as never,
          ai_model: input.aiModel ?? null,
          ai_scope: input.aiScope ?? null,
          duration_ms: input.durationMs ?? null,
          operator_id: ctx.operatorId ?? null,
        });
      } catch {
        // swallow: tracing must NEVER break the real pipeline
      }
    },
  };
}

export function newTraceId(): string {
  return crypto.randomUUID();
}