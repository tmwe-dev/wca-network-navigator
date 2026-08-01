/**
 * DAL — telemetria (page_events, request_logs, ai_request_log).
 *
 * Le righe generate da Supabase vengono mappate sui contratti di
 * `@/types/telemetry` con normalizzazione runtime: nessun cast cieco.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toRecordOrNull } from "@/lib/records";
import type { PageEventRow, RequestLogRow, AIRequestLogRow } from "@/types/telemetry";

type PageEventInsert = Database["public"]["Tables"]["page_events"]["Insert"];
type PageEventDbRow = Database["public"]["Tables"]["page_events"]["Row"];
type RequestLogDbRow = Database["public"]["Tables"]["request_logs"]["Row"];
type AiRequestLogDbRow = Database["public"]["Tables"]["ai_request_log"]["Row"];

/** Numero estratto da una colonna Json solo se realmente numerico. */
function numFromMeta(meta: Record<string, unknown> | null, key: string): number | null {
  const v = meta?.[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function mapPageEvent(r: PageEventDbRow): PageEventRow {
  return {
    id: r.id,
    user_id: r.user_id,
    session_id: r.session_id,
    event_name: r.event_name,
    page: r.page,
    entity_type: r.entity_type,
    entity_id: r.entity_id,
    props: toRecordOrNull(r.props),
    duration_ms: r.duration_ms,
    created_at: r.created_at,
  };
}

function mapRequestLog(r: RequestLogDbRow): RequestLogRow {
  return {
    id: r.id,
    trace_id: r.trace_id,
    user_id: r.user_id,
    function_name: r.function_name,
    channel: r.channel ?? "unknown",
    http_status: r.http_status,
    status: r.status ?? "unknown",
    latency_ms: r.latency_ms,
    error_code: r.error_code,
    error_message: r.error_message,
    created_at: r.created_at ?? "",
  };
}

function mapAiRequestLog(r: AiRequestLogDbRow): AIRequestLogRow {
  const meta = toRecordOrNull(r.metadata);
  return {
    id: r.id,
    trace_id: r.trace_id,
    user_id: r.user_id,
    agent_code: r.agent_code,
    channel: r.channel ?? "unknown",
    model: r.model,
    prompt_tokens: numFromMeta(meta, "prompt_tokens"),
    completion_tokens: numFromMeta(meta, "completion_tokens"),
    total_tokens: r.total_tokens,
    cost_usd: numFromMeta(meta, "cost_usd"),
    latency_ms: r.latency_ms,
    status: r.status ?? "unknown",
    intent: r.intent,
    created_at: r.created_at ?? "",
  };
}

export async function insertPageEvent(payload: PageEventInsert) {
  await supabase.from("page_events").insert(payload);
}

/** Log delle chiamate edge dal periodo indicato, più recenti prima. */
export async function findRequestLogsSince(sinceIso: string, limit = 500): Promise<RequestLogRow[]> {
  const { data, error } = await supabase
    .from("request_logs")
    .select("*")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(mapRequestLog);
}

/** Log delle richieste AI dal periodo indicato, più recenti prima. */
export async function findAiRequestLogsSince(sinceIso: string, limit = 500): Promise<AIRequestLogRow[]> {
  const { data, error } = await supabase
    .from("ai_request_log")
    .select("*")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(mapAiRequestLog);
}

/** Eventi di pagina dal periodo indicato, più recenti prima. */
export async function findPageEventsSince(sinceIso: string, limit = 500): Promise<PageEventRow[]> {
  const { data, error } = await supabase
    .from("page_events")
    .select("*")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(mapPageEvent);
}
