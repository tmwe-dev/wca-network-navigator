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
}

export interface ToolTrace {
  readonly id: string;
  readonly prompt: string;
  readonly steps: TraceStep[];
  readonly totalMs: number;
  readonly startedAt: number;
}

class TraceBuilder {
  private steps: TraceStep[] = [];
  private startTs: number;
  private prompt: string;

  constructor(prompt: string) {
    this.startTs = Date.now();
    this.prompt = prompt;
  }

  add(step: TraceStep): void {
    this.steps.push(step);
  }

  finish(): ToolTrace {
    const totalMs = Date.now() - this.startTs;
    const trace: ToolTrace = {
      id: `${this.startTs}-${Math.random().toString(36).slice(2, 6)}`,
      prompt: this.prompt,
      steps: [...this.steps],
      totalMs,
      startedAt: this.startTs,
    };
    if (typeof console !== "undefined" && console.info) {
      console.info("[command-trace]", {
        prompt: trace.prompt,
        totalMs: trace.totalMs,
        steps: trace.steps,
      });
    }
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
