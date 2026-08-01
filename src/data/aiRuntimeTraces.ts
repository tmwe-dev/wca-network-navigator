/**
 * DAL — ai_runtime_traces (insert-only dal frontend, RLS: user_id = auth.uid()).
 * Colonne verificate sullo schema live: id, user_id, correlation_id, ts, type,
 * scope, source, route, status, duration_ms, payload_summary, error, created_at.
 */
import { supabase } from "@/integrations/supabase/client";
import { toJsonValue } from "@/lib/typedJson";
import type { TablesInsert } from "@/integrations/supabase/types";

export interface RuntimeTraceInput {
  id: string;
  user_id: string;
  correlation_id: string;
  ts: string;
  type: string;
  scope: string | null;
  source: string | null;
  route: string | null;
  status: string | null;
  duration_ms: number | null;
  payload_summary: Record<string, unknown>;
  error: Record<string, unknown> | null;
}

/** Inserisce un batch di trace. Ritorna il messaggio d'errore, o null se OK. */
export async function insertRuntimeTraces(rows: RuntimeTraceInput[]): Promise<string | null> {
  if (rows.length === 0) return null;
  const payload: TablesInsert<"ai_runtime_traces">[] = rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    correlation_id: r.correlation_id,
    ts: r.ts,
    type: r.type,
    scope: r.scope,
    source: r.source,
    route: r.route,
    status: r.status,
    duration_ms: r.duration_ms,
    payload_summary: toJsonValue(r.payload_summary),
    error: r.error === null ? null : toJsonValue(r.error),
  }));
  const { error } = await supabase.from("ai_runtime_traces").insert(payload);
  return error ? error.message : null;
}
