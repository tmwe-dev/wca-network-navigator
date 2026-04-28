/**
 * traceCollector — singleton bus + ring buffer + DB flusher.
 *
 * - In memoria: ring buffer (max 500 eventi) sempre disponibile per la UI.
 * - DB: flush batchato (≤25 eventi o 5s) verso `ai_runtime_traces` se utente loggato.
 * - Subscribers React: notify on push.
 * - Pause / resume / clear esposti per la UI.
 * - Ogni invocazione AI/edge crea un correlation_id; i sotto-eventi (db.query)
 *   possono ereditarlo via getActiveCorrelationId() durante la finestra di vita.
 */
import { supabase } from "@/integrations/supabase/client";
import type { TraceEvent, TraceRow } from "./traceTypes";

const MAX_BUFFER = 500;
const FLUSH_BATCH = 25;
const FLUSH_INTERVAL_MS = 5000;
const PAYLOAD_MAX_BYTES = 1024;

type Listener = (events: TraceEvent[]) => void;

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function summarize(payload: unknown): Record<string, unknown> {
  if (payload === null || payload === undefined) return {};
  let json: string;
  try {
    json = JSON.stringify(payload);
  } catch {
    return { _truncated: true, _reason: "non-serializable" };
  }
  if (json.length <= PAYLOAD_MAX_BYTES) {
    try {
      return JSON.parse(json) as Record<string, unknown>;
    } catch {
      return { value: json };
    }
  }
  return { _truncated: true, _bytes: json.length, preview: json.slice(0, PAYLOAD_MAX_BYTES) };
}

class TraceCollector {
  private buffer: TraceEvent[] = [];
  private listeners = new Set<Listener>();
  private pending: TraceEvent[] = [];
  private paused = false;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private dbEnabled = true;
  private currentUserId: string | null = null;
  private activeCorrelation: string | null = null;

  init(opts: { dbEnabled?: boolean } = {}) {
    this.dbEnabled = opts.dbEnabled ?? true;
    if (!this.flushTimer) {
      this.flushTimer = setInterval(() => void this.flush(), FLUSH_INTERVAL_MS);
    }
    // Cattura user id corrente
    void supabase.auth.getSession().then(({ data }) => {
      this.currentUserId = data.session?.user.id ?? null;
    });
    supabase.auth.onAuthStateChange((_e, session) => {
      this.currentUserId = session?.user.id ?? null;
    });
  }

  setPaused(p: boolean) { this.paused = p; }
  isPaused() { return this.paused; }

  setDbEnabled(v: boolean) { this.dbEnabled = v; }

  /** Returns a fresh correlation id and marks it active. */
  startCorrelation(): string {
    const id = uuid();
    this.activeCorrelation = id;
    // Auto-clear dopo 30s per sicurezza
    setTimeout(() => {
      if (this.activeCorrelation === id) this.activeCorrelation = null;
    }, 30_000);
    return id;
  }

  /** Returns the currently active correlation (e.g., during an AI call). */
  getActiveCorrelationId(): string | null {
    return this.activeCorrelation;
  }

  endCorrelation(id: string) {
    if (this.activeCorrelation === id) this.activeCorrelation = null;
  }

  /** Push an event into the ring buffer + queue for DB flush. */
  push(partial: Omit<TraceEvent, "id" | "ts" | "correlation_id"> & { correlation_id?: string }) {
    if (this.paused) return;
    const ev: TraceEvent = {
      id: uuid(),
      ts: Date.now(),
      correlation_id: partial.correlation_id ?? this.activeCorrelation ?? uuid(),
      ...partial,
      payload_summary: summarize(partial.payload_summary ?? {}),
    };
    this.buffer.push(ev);
    if (this.buffer.length > MAX_BUFFER) this.buffer.shift();
    this.pending.push(ev);
    if (this.pending.length >= FLUSH_BATCH) void this.flush();
    this.notify();
  }

  getBuffer(): TraceEvent[] { return [...this.buffer]; }

  clear() {
    this.buffer = [];
    this.notify();
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    const snap = this.buffer;
    this.listeners.forEach((l) => {
      try { l(snap); } catch { /* ignore listener errors */ }
    });
  }

  private async flush(): Promise<void> {
    if (!this.dbEnabled) { this.pending = []; return; }
    if (this.pending.length === 0) return;
    const userId = this.currentUserId;
    if (!userId) return; // niente sessione → niente DB (ma il buffer in memoria continua)
    const batch = this.pending.splice(0, this.pending.length);
    const rows: TraceRow[] = batch.map((e) => ({
      id: e.id,
      user_id: userId,
      correlation_id: e.correlation_id,
      ts: new Date(e.ts).toISOString(),
      type: e.type,
      scope: e.scope ?? null,
      source: e.source ?? null,
      route: e.route ?? null,
      status: e.status ?? null,
      duration_ms: e.duration_ms ?? null,
      payload_summary: e.payload_summary ?? {},
      error: e.error ? (e.error as unknown as Record<string, unknown>) : null,
    }));
    try {
      // Insert insert-only — RLS richiede user_id = auth.uid()
      // deno-lint-ignore no-explicit-any
      const { error } = await untypedFrom("ai_runtime_traces").insert(rows);
      if (error) {
        // Re-queue se errore transient (max 1 retry implicito al prossimo tick)
        // Per non loopare in modo aggressivo, droppiamo dopo log.
        console.warn("[traceCollector] flush failed:", error.message);
      }
    } catch (err) {
      console.warn("[traceCollector] flush threw:", err);
    }
  }
}

export const traceCollector = new TraceCollector();

/** Helper: misura una promise emettendo start/end events. */
export async function traced<T>(
  meta: { type: "ai.invoke" | "edge.invoke"; scope?: string; source?: string; payload_summary?: Record<string, unknown> },
  fn: () => Promise<T>,
): Promise<T> {
  const corr = traceCollector.startCorrelation();
  const route = typeof window !== "undefined" ? window.location.pathname : undefined;
  const start = Date.now();
  try {
    const result = await fn();
    traceCollector.push({
      type: meta.type,
      scope: meta.scope,
      source: meta.source,
      route,
      status: "success",
      duration_ms: Date.now() - start,
      payload_summary: meta.payload_summary,
      correlation_id: corr,
    });
    return result;
  } catch (err) {
    const e = err as { message?: string; code?: string; httpStatus?: number };
    traceCollector.push({
      type: meta.type,
      scope: meta.scope,
      source: meta.source,
      route,
      status: "error",
      duration_ms: Date.now() - start,
      payload_summary: meta.payload_summary,
      error: { message: e?.message ?? String(err), code: e?.code, status: e?.httpStatus },
      correlation_id: corr,
    });
    throw err;
  } finally {
    traceCollector.endCorrelation(corr);
  }
}