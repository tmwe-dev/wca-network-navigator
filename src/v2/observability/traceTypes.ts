/**
 * Trace Console — schema TS degli eventi raccolti dal frontend.
 * Il bus emette TraceEvent; il flusher li serializza verso ai_runtime_traces.
 */

export type TraceEventType =
  | "ai.invoke"
  | "edge.invoke"
  | "db.query"
  | "flow.step"
  | "manual";

export type TraceStatus = "pending" | "success" | "error" | string;

export interface TraceEvent {
  id: string;                       // uuid
  ts: number;                       // ms epoch
  type: TraceEventType;
  scope?: string;                   // es. "command", "agent"
  source?: string;                  // hook/component label
  route?: string;                   // location.pathname
  status?: TraceStatus;
  duration_ms?: number;
  payload_summary?: Record<string, unknown>;
  error?: { message: string; code?: string; status?: number };
  correlation_id: string;           // groups events of one user action
  request_id?: string;              // optional propagated id
}

/** Record that goes to DB. */
export interface TraceRow {
  id: string;
  user_id: string;
  correlation_id: string;
  ts: string;                       // ISO
  type: TraceEventType;
  scope: string | null;
  source: string | null;
  route: string | null;
  status: string | null;
  duration_ms: number | null;
  payload_summary: Record<string, unknown>;
  error: Record<string, unknown> | null;
}