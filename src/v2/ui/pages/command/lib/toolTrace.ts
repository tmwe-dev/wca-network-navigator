import { createLogger } from "@/lib/log";
const log = createLogger("toolTrace");
/**
 * toolTrace — lightweight per-message execution tracing.
 *
 * Captures: which tools/LLM hops were invoked, their duration, and source
 * (fast-lane / planner / comment / DB). Used to render a collapsible perf
 * panel under each Direttore answer and to log to console in dev.
 *
 * Single-tab, in-memory; no persistence.
 */

export type TraceSource = "fast-lane" | "planner" | "ai-query" | "comment" | "db" | "tts" | "tool";

export interface TraceStep {
  readonly source: TraceSource;
  readonly label: string;
  readonly durationMs: number;
  readonly meta?: string;
  readonly toolId?: string;
  readonly reasoning?: string;
  readonly stepNumber?: number;
  readonly status?: "ok" | "failed" | "approved" | "skipped";
}

export interface TraceReference {
  readonly kind: "operative-prompt" | "kb-section" | "model" | "playbook" | "context";
  readonly label: string;
  readonly value?: string;
}

export interface ToolTrace {
  readonly id: string;
  readonly prompt: string;
  readonly steps: TraceStep[];
  readonly totalMs: number;
  readonly startedAt: number;
  readonly phase?: "fast-lane" | "plan-execution" | "approval-step";
  readonly planSummary?: string;
  readonly driver?: string;
  readonly references?: TraceReference[];
}

class TraceBuilder {
  private steps: TraceStep[] = [];
  private startTs: number;
  private prompt: string;
  private phase?: "fast-lane" | "plan-execution" | "approval-step";
  private planSummary?: string;
  private driver?: string;
  private references: TraceReference[] = [];

  constructor(prompt: string) {
    this.startTs = Date.now();
    this.prompt = prompt;
  }

  add(step: TraceStep): void {
    this.steps.push(step);
  }

  setPhase(phase: "fast-lane" | "plan-execution" | "approval-step"): void {
    this.phase = phase;
  }

  setPlanSummary(summary: string | undefined): void {
    this.planSummary = summary;
  }

  setDriver(driver: string): void {
    this.driver = driver;
  }

  addReference(ref: TraceReference): void {
    // Dedup per (kind, label, value)
    const key = `${ref.kind}|${ref.label}|${ref.value ?? ""}`;
    if (!this.references.some((r) => `${r.kind}|${r.label}|${r.value ?? ""}` === key)) {
      this.references.push(ref);
    }
  }

  finish(): ToolTrace {
    const totalMs = Date.now() - this.startTs;
    const trace: ToolTrace = {
      id: `${this.startTs}-${Math.random().toString(36).slice(2, 6)}`,
      prompt: this.prompt,
      steps: [...this.steps],
      totalMs,
      startedAt: this.startTs,
      phase: this.phase,
      planSummary: this.planSummary,
      driver: this.driver,
      references: [...this.references],
    };
    log.info("[command-trace]", {
        prompt: trace.prompt,
        phase: trace.phase,
        driver: trace.driver,
        totalMs: trace.totalMs,
        steps: trace.steps,
        references: trace.references,
      });
    return trace;
  }
}

export function startTrace(prompt: string): TraceBuilder {
  return new TraceBuilder(prompt);
}

export type { TraceBuilder };

/** Format trace as a one-liner for inline display */
export function formatTraceLine(trace: ToolTrace): string {
  const parts = trace.steps.map((s) => `${s.label} ${(s.durationMs / 1000).toFixed(2)}s`);
  return `⚡ ${(trace.totalMs / 1000).toFixed(2)}s • ${parts.join(" → ")}`;
}
