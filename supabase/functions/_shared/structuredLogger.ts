/**
 * structuredLogger.ts
 *
 * Lightweight JSON logger + metrics emitter for edge functions.
 *
 * Goals:
 *  - Replace silent `catch {}` with structured, queryable logs.
 *  - Emit performance + error metrics into `public.edge_metrics` for dashboards.
 *  - Console output is always JSON (one line per event) so Supabase log search works.
 *  - Never throw — logger failures must not break the calling function.
 *
 * Usage:
 *   const log = createLogger("ai-assistant", { userId, requestId });
 *   log.info("started");
 *   try { ... } catch (e) { log.error("kb_load_failed", e, { kbType: "sales" }); }
 *   log.metric("llm_call", { duration_ms: 1234, model: "gemini-2.5-flash" });
 *   await log.flush(); // optional: persist queued metrics before returning
 */

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type LogSeverity = "debug" | "info" | "warn" | "error" | "critical";
export type EventType = "error" | "perf" | "warn" | "info" | "metric";

export interface LogContext {
  userId?: string | null;
  requestId?: string | null;
  partnerId?: string | null;
  contactId?: string | null;
  [key: string]: unknown;
}

interface MetricRow {
  function_name: string;
  event_type: EventType;
  severity: LogSeverity;
  message: string | null;
  duration_ms: number | null;
  status_code: number | null;
  user_id: string | null;
  context: Record<string, unknown>;
  tags: string[];
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

let _adminClient: SupabaseClient | null = null;
function getAdmin(): SupabaseClient | null {
  if (!SUPABASE_URL || !SERVICE_ROLE) return null;
  if (!_adminClient) {
    _adminClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _adminClient;
}

function safeStringify(value: unknown): string {
  try {
    if (value instanceof Error) {
      return JSON.stringify({ name: value.name, message: value.message, stack: value.stack });
    }
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function errorToContext(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return { error_name: err.name, error_message: err.message, error_stack: err.stack?.split("\n").slice(0, 8).join("\n") };
  }
  if (typeof err === "string") return { error_message: err };
  if (err && typeof err === "object") return { error_payload: err as Record<string, unknown> };
  return { error_message: String(err) };
}

export interface StructuredLogger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  /** Logs an error with full stack trace and queues an `error` metric row. */
  error(message: string, err: unknown, context?: Record<string, unknown>): void;
  /** Critical: same as error but severity=critical (paged / alerted). */
  critical(message: string, err: unknown, context?: Record<string, unknown>): void;
  /** Records a perf/metric data point (duration, counts, model name, etc.). */
  metric(name: string, fields: { duration_ms?: number; status_code?: number; tags?: string[]; [k: string]: unknown }): void;
  /** Flush queued metric rows to DB. Call once before responding (best-effort, non-throwing). */
  flush(): Promise<void>;
  /** Time an async block and emit a `perf` metric automatically. */
  time<T>(name: string, fn: () => Promise<T>, extra?: Record<string, unknown>): Promise<T>;
  /** Returns child logger inheriting context. */
  child(extra: LogContext): StructuredLogger;
}

export function createLogger(functionName: string, baseContext: LogContext = {}): StructuredLogger {
  const queue: MetricRow[] = [];

  function emit(severity: LogSeverity, eventType: EventType, message: string, extra: Record<string, unknown>): void {
    const merged = { ...baseContext, ...extra };
    const userId = (merged.userId ?? merged.user_id ?? null) as string | null;
    const line = {
      ts: new Date().toISOString(),
      fn: functionName,
      severity,
      event: eventType,
      msg: message,
      ctx: merged,
    };
    // Single-line JSON log — searchable in Supabase function logs.
    const out = severity === "error" || severity === "critical" ? console.error : severity === "warn" ? console.warn : console.log;
    try { out(safeStringify(line)); } catch { /* never throw from logger */ }

    // Queue persistent rows for error/perf/critical metrics (info/debug stay log-only).
    if (eventType === "error" || eventType === "perf" || eventType === "metric" || severity === "critical") {
      const duration = typeof merged.duration_ms === "number" ? merged.duration_ms : null;
      const status = typeof merged.status_code === "number" ? merged.status_code : null;
      const tags = Array.isArray(merged.tags) ? (merged.tags as string[]) : [];
      queue.push({
        function_name: functionName,
        event_type: eventType,
        severity,
        message: message.slice(0, 500),
        duration_ms: duration,
        status_code: status,
        user_id: userId,
        context: merged,
        tags,
      });
    }
  }

  const api: StructuredLogger = {
    debug(message, context = {}) { emit("debug", "info", message, context); },
    info(message, context = {}) { emit("info", "info", message, context); },
    warn(message, context = {}) { emit("warn", "warn", message, context); },
    error(message, err, context = {}) {
      emit("error", "error", message, { ...context, ...errorToContext(err) });
    },
    critical(message, err, context = {}) {
      emit("critical", "error", message, { ...context, ...errorToContext(err) });
    },
    metric(name, fields) {
      const { duration_ms, status_code, tags, ...rest } = fields;
      const eventType: EventType = typeof duration_ms === "number" ? "perf" : "metric";
      emit("info", eventType, name, { ...rest, duration_ms, status_code, tags });
    },
    async time(name, fn, extra = {}) {
      const t0 = performance.now();
      try {
        const result = await fn();
        api.metric(name, { duration_ms: Math.round(performance.now() - t0), outcome: "ok", ...extra });
        return result;
      } catch (e) {
        api.metric(name, { duration_ms: Math.round(performance.now() - t0), outcome: "error", ...extra });
        throw e;
      }
    },
    async flush() {
      if (queue.length === 0) return;
      const admin = getAdmin();
      if (!admin) { queue.length = 0; return; }
      const batch = queue.splice(0, queue.length);
      try {
        await admin.from("edge_metrics").insert(batch as never);
      } catch (e) {
        // Logger must never throw — surface to console only.
        try { console.error(safeStringify({ ts: new Date().toISOString(), fn: functionName, severity: "warn", event: "warn", msg: "edge_metrics_flush_failed", ctx: errorToContext(e) })); } catch { /* noop */ }
      }
    },
    child(extra) {
      return createLogger(functionName, { ...baseContext, ...extra });
    },
  };

  return api;
}

/** Convenience for Edge Function entry points: ensures flush() runs even on error. */
export async function withLogger<T>(
  functionName: string,
  baseContext: LogContext,
  handler: (log: StructuredLogger) => Promise<T>,
): Promise<T> {
  const log = createLogger(functionName, baseContext);
  try {
    return await handler(log);
  } finally {
    await log.flush();
  }
}
