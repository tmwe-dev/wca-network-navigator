/**
 * Contratti di riga per le viste di telemetria.
 *
 * Vivono nel layer `types` (non nella UI) perché sono il contratto prodotto
 * dal DAL `src/data/telemetry.ts` e consumato dalle viste v2.
 */
export interface PageEventRow {
  id: string;
  user_id: string | null;
  session_id: string | null;
  event_name: string;
  page: string;
  entity_type: string | null;
  entity_id: string | null;
  props: Record<string, unknown> | null;
  duration_ms: number | null;
  created_at: string;
}

export interface RequestLogRow {
  id: string;
  trace_id: string | null;
  user_id: string | null;
  function_name: string;
  channel: string;
  http_status: number | null;
  status: string;
  latency_ms: number | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
}

export interface AIRequestLogRow {
  id: string;
  trace_id: string | null;
  user_id: string | null;
  agent_code: string | null;
  channel: string;
  model: string | null;
  /** Non presente in colonna: derivato da `metadata.prompt_tokens` se numerico. */
  prompt_tokens: number | null;
  /** Non presente in colonna: derivato da `metadata.completion_tokens`. */
  completion_tokens: number | null;
  total_tokens: number | null;
  /** Non presente in colonna: derivato da `metadata.cost_usd`. */
  cost_usd: number | null;
  latency_ms: number | null;
  status: string;
  intent: string | null;
  created_at: string;
}
