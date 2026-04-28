/**
 * Flow definitions — checklist statiche per i flussi critici del sistema.
 * Ogni step descrive come matchare un evento del trace buffer.
 */
import type { TraceEvent } from "./traceTypes";

export interface FlowStep {
  id: string;
  label: string;
  /** match function: ritorna true se l'evento soddisfa lo step */
  match: (e: TraceEvent) => boolean;
  required?: boolean;            // default true
}

export interface FlowDefinition {
  id: string;
  label: string;
  description: string;
  /** trigger event identifies the flow (es. invocazione di send-email) */
  trigger: (e: TraceEvent) => boolean;
  steps: FlowStep[];
}

const eq = (s?: string) => (e: TraceEvent) => e.source === s || e.scope === s;
const sourceContains = (sub: string) => (e: TraceEvent) =>
  (e.source ?? "").toLowerCase().includes(sub.toLowerCase());

export const FLOW_DEFINITIONS: FlowDefinition[] = [
  {
    id: "send-email-direct",
    label: "Invio email diretto",
    description: "Pipeline per email inviate dal frontend (SendEmailDialog, useSendEmail).",
    trigger: (e) =>
      e.type === "edge.invoke" && (sourceContains("send-email")(e) || (e.payload_summary?.functionName as string) === "send-email"),
    steps: [
      { id: "edge-send-email", label: "edge.invoke send-email", match: (e) => e.type === "edge.invoke" && sourceContains("send-email")(e) },
      { id: "post-send-activity", label: "DB insert activities (post-send)", match: (e) => e.type === "db.query" && (e.source ?? "").includes("activities") },
    ],
  },
  {
    id: "command-ai-query",
    label: "Command — AI Query",
    description: "Pipeline ricerca AI dalla pagina Command.",
    trigger: (e) => e.type === "ai.invoke" && (e.scope === "command" || sourceContains("ai-query-planner")(e)),
    steps: [
      { id: "planner", label: "ai-query-planner", match: (e) => e.type === "ai.invoke" && sourceContains("planner")(e) },
      { id: "executor", label: "executeQueryPlan (DB select)", match: (e) => e.type === "db.query" && e.status === "success" },
      { id: "comment", label: "ai-comment (opzionale)", match: (e) => e.type === "ai.invoke" && sourceContains("comment")(e), required: false },
    ],
  },
  {
    id: "agent-loop",
    label: "Agent Loop (LUCA / agenti)",
    description: "Esecuzione agente AI con persona+capabilities+prompt.",
    trigger: (e) => e.type === "ai.invoke" && (sourceContains("agent-loop")(e) || sourceContains("agent-execute")(e)),
    steps: [
      { id: "agent-call", label: "edge AI agent-loop", match: (e) => e.type === "ai.invoke" && (sourceContains("agent-loop")(e) || sourceContains("agent-execute")(e)) },
      { id: "tool-exec", label: "tool execution (db.query o edge)", match: (e) => e.type === "db.query" || e.type === "edge.invoke", required: false },
    ],
  },
  {
    id: "deep-search",
    label: "Deep Search (Sherlock)",
    description: "Ricerca strutturata con preset di qualità.",
    trigger: (e) => e.type === "ai.invoke" && (e.scope === "sherlock" || sourceContains("sherlock")(e)),
    steps: [
      { id: "sherlock", label: "sherlock-extract", match: (e) => sourceContains("sherlock")(e) },
    ],
  },
];

/**
 * Group buffer events by correlation_id, then per-correlation try to match
 * against any FLOW_DEFINITIONS whose trigger matches one of the events.
 * Returns one ChecklistResult per (correlation, matched flow).
 */
export interface ChecklistResult {
  correlation_id: string;
  flow: FlowDefinition;
  startedAt: number;
  steps: Array<{ step: FlowStep; matched: TraceEvent | null }>;
  passed: number;
  missing: number;
}

export function buildChecklists(events: TraceEvent[]): ChecklistResult[] {
  const byCorr = new Map<string, TraceEvent[]>();
  for (const e of events) {
    if (!byCorr.has(e.correlation_id)) byCorr.set(e.correlation_id, []);
    byCorr.get(e.correlation_id)!.push(e);
  }
  const results: ChecklistResult[] = [];
  for (const [corr, evs] of byCorr) {
    for (const flow of FLOW_DEFINITIONS) {
      const trigger = evs.find(flow.trigger);
      if (!trigger) continue;
      const steps = flow.steps.map((s) => ({
        step: s,
        matched: evs.find(s.match) ?? null,
      }));
      const required = steps.filter((s) => s.step.required !== false);
      const passed = required.filter((s) => s.matched).length;
      const missing = required.length - passed;
      results.push({
        correlation_id: corr,
        flow,
        startedAt: trigger.ts,
        steps,
        passed,
        missing,
      });
    }
  }
  results.sort((a, b) => b.startedAt - a.startedAt);
  return results;
}