/**
 * TraceConsole — pop-up flottante globale (singleton in App.tsx).
 *
 * Tabs:
 *  - Trace: lista eventi reali (ai/edge/db) in ordine cronologico, filtrabili.
 *  - Checklist: per ogni correlation_id che matcha una FlowDefinition, mostra
 *    quali step sono passati (verde) e quali mancano (rosso).
 *
 * Hotkey: Ctrl+Shift+T per toggle.
 * Stato: persistito in localStorage (open/pinned/filters/position).
 * Visibile solo a operatori autenticati (RLS lato DB già protegge i dati).
 */
import { useEffect, useMemo, useState } from "react";
import { traceCollector } from "./traceCollector";
import { useTraceBuffer } from "./hooks/useTraceBuffer";
import { buildChecklists } from "./flowDefinitions";
import type { TraceEvent, TraceEventType } from "./traceTypes";
import { useAuth } from "@/providers/AuthProvider";

const STORAGE_KEY = "trace_console_state_v1";

interface PersistedState {
  open: boolean;
  tab: "trace" | "checklist";
  filters: { type: TraceEventType | "all"; search: string };
  position: { x: number; y: number };
}

function loadState(): PersistedState {
  if (typeof localStorage === "undefined") return defaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return { ...defaultState(), ...(JSON.parse(raw) as Partial<PersistedState>) };
  } catch {
    return defaultState();
  }
}
function defaultState(): PersistedState {
  return {
    open: false,
    tab: "trace",
    filters: { type: "all", search: "" },
    position: { x: 16, y: 16 },
  };
}
function saveState(s: PersistedState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* noop */ }
}

function fmtTime(ts: number) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}.${String(d.getMilliseconds()).padStart(3, "0")}`;
}

function statusColor(status?: string): string {
  if (!status) return "text-muted-foreground";
  if (status === "success" || status === "200") return "text-emerald-500";
  if (status === "error") return "text-rose-500";
  if (status === "pending") return "text-amber-500";
  if (/^[45]\d\d$/.test(status)) return "text-rose-500";
  return "text-muted-foreground";
}

function typeBadge(t: TraceEventType): string {
  switch (t) {
    case "ai.invoke": return "bg-violet-500/15 text-violet-600 border-violet-500/30";
    case "edge.invoke": return "bg-blue-500/15 text-blue-600 border-blue-500/30";
    case "db.query": return "bg-emerald-500/15 text-emerald-600 border-emerald-500/30";
    case "flow.step": return "bg-amber-500/15 text-amber-600 border-amber-500/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

export function TraceConsole() {
  const { user } = useAuth();
  const [state, setState] = useState<PersistedState>(() => loadState());
  const [paused, setPaused] = useState<boolean>(false);
  const events = useTraceBuffer();

  useEffect(() => { saveState(state); }, [state]);

  // Hotkey Ctrl+Shift+T
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "T" || e.key === "t")) {
        e.preventDefault();
        setState((s) => ({ ...s, open: !s.open }));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // External open event (es. menu Strumenti in top bar)
  useEffect(() => {
    const open = () => setState((s) => ({ ...s, open: true }));
    window.addEventListener("trace-console-open", open);
    return () => window.removeEventListener("trace-console-open", open);
  }, []);

  // Hooks MUST run in the same order on every render.
  // Compute derived state BEFORE any conditional return.
  const filtered = useMemo(() => {
    const q = state.filters.search.trim().toLowerCase();
    return events
      .filter((e) => state.filters.type === "all" || e.type === state.filters.type)
      .filter((e) => {
        if (!q) return true;
        const blob = `${e.scope ?? ""} ${e.source ?? ""} ${e.route ?? ""} ${JSON.stringify(e.payload_summary ?? {})}`.toLowerCase();
        return blob.includes(q);
      })
      .slice()
      .reverse();
  }, [events, state.filters]);

  const checklists = useMemo(() => buildChecklists(events), [events]);

  if (!user) return null; // niente console per anon (after hooks)

  const togglePause = () => {
    setPaused((p) => {
      traceCollector.setPaused(!p);
      return !p;
    });
  };

  return (
    <>
      {/* Floating trigger always visible */}
      <button
        type="button"
        onClick={() => setState((s) => ({ ...s, open: !s.open }))}
        className="fixed bottom-4 right-4 z-[9998] h-10 w-10 rounded-full border border-border bg-background/90 backdrop-blur shadow-md flex items-center justify-center text-xs font-mono hover:bg-accent transition"
        title="Trace Console (Ctrl+Shift+T)"
        aria-label="Trace Console"
      >
        🩺
      </button>

      {state.open && (
        <div
          className="fixed z-[9999] w-[520px] max-w-[95vw] h-[60vh] max-h-[640px] flex flex-col rounded-lg border border-border bg-background/98 backdrop-blur shadow-2xl text-foreground"
          style={{ left: state.position.x, bottom: state.position.y + 56 }}
          role="dialog"
          aria-label="Trace Console"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span>Trace Console</span>
              <span className="text-muted-foreground font-normal">{events.length} eventi</span>
              {paused && <span className="text-amber-500">⏸ paused</span>}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={togglePause} className="px-2 py-0.5 text-xs rounded border border-border hover:bg-accent" title="Pause/Resume">
                {paused ? "▶" : "⏸"}
              </button>
              <button onClick={() => traceCollector.clear()} className="px-2 py-0.5 text-xs rounded border border-border hover:bg-accent" title="Clear buffer">
                🗑
              </button>
              <button onClick={() => setState((s) => ({ ...s, open: false }))} className="px-2 py-0.5 text-xs rounded border border-border hover:bg-accent" title="Close">
                ✕
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border text-xs">
            <button
              className={`flex-1 py-1.5 ${state.tab === "trace" ? "bg-accent" : "hover:bg-accent/50"}`}
              onClick={() => setState((s) => ({ ...s, tab: "trace" }))}
            >
              Trace ({events.length})
            </button>
            <button
              className={`flex-1 py-1.5 ${state.tab === "checklist" ? "bg-accent" : "hover:bg-accent/50"}`}
              onClick={() => setState((s) => ({ ...s, tab: "checklist" }))}
            >
              Checklist ({checklists.length})
            </button>
          </div>

          {state.tab === "trace" && (
            <>
              {/* Filters */}
              <div className="flex gap-1 p-2 border-b border-border text-xs">
                <select
                  value={state.filters.type}
                  onChange={(e) => setState((s) => ({ ...s, filters: { ...s.filters, type: e.target.value as TraceEventType | "all" } }))}
                  className="px-1 py-0.5 rounded border border-border bg-background"
                >
                  <option value="all">all</option>
                  <option value="ai.invoke">ai.invoke</option>
                  <option value="edge.invoke">edge.invoke</option>
                  <option value="db.query">db.query</option>
                  <option value="flow.step">flow.step</option>
                </select>
                <input
                  value={state.filters.search}
                  onChange={(e) => setState((s) => ({ ...s, filters: { ...s.filters, search: e.target.value } }))}
                  placeholder="filtra per scope, source, payload…"
                  className="flex-1 px-2 py-0.5 rounded border border-border bg-background"
                />
              </div>
              {/* List */}
              <div className="flex-1 overflow-auto font-mono text-[11px]">
                {filtered.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">Nessun evento — esegui un'azione nell'app.</div>
                ) : filtered.map((e) => (
                  <TraceRow key={e.id} ev={e} />
                ))}
              </div>
            </>
          )}

          {state.tab === "checklist" && (
            <div className="flex-1 overflow-auto p-2 space-y-2 text-xs">
              {checklists.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">Nessun flusso noto eseguito di recente.</div>
              ) : checklists.map((c) => (
                <div key={`${c.correlation_id}-${c.flow.id}`} className="rounded border border-border p-2">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{c.flow.label}</div>
                    <div className={`text-[10px] ${c.missing === 0 ? "text-emerald-500" : "text-amber-500"}`}>
                      {c.passed}/{c.passed + c.missing} step
                    </div>
                  </div>
                  <div className="text-[10px] text-muted-foreground mb-1">{fmtTime(c.startedAt)} · corr {c.correlation_id.slice(0, 8)}</div>
                  <ul className="space-y-0.5">
                    {c.steps.map(({ step, matched }) => (
                      <li key={step.id} className="flex items-center gap-2">
                        <span>{matched ? "✅" : (step.required === false ? "⚪" : "❌")}</span>
                        <span className={matched ? "" : (step.required === false ? "text-muted-foreground" : "text-rose-500")}>{step.label}</span>
                        {matched?.duration_ms !== undefined && <span className="text-muted-foreground">({matched.duration_ms}ms)</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function TraceRow({ ev }: { ev: TraceEvent }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border/60 px-2 py-1 hover:bg-accent/40">
      <button onClick={() => setOpen((o) => !o)} className="w-full text-left flex items-center gap-2">
        <span className="text-muted-foreground">{fmtTime(ev.ts)}</span>
        <span className={`px-1 rounded border text-[9px] ${typeBadge(ev.type)}`}>{ev.type}</span>
        <span className="truncate flex-1">{ev.source ?? ev.scope ?? "—"}</span>
        {ev.duration_ms !== undefined && <span className="text-muted-foreground">{ev.duration_ms}ms</span>}
        <span className={statusColor(ev.status)}>{ev.status ?? "—"}</span>
      </button>
      {open && (
        <pre className="mt-1 ml-4 text-[10px] text-muted-foreground whitespace-pre-wrap break-all">
{`scope: ${ev.scope ?? "-"}
route: ${ev.route ?? "-"}
corr:  ${ev.correlation_id}
payload: ${JSON.stringify(ev.payload_summary ?? {}, null, 2)}${ev.error ? `
error:   ${JSON.stringify(ev.error, null, 2)}` : ""}`}
        </pre>
      )}
    </div>
  );
}