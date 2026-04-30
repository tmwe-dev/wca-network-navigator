/**
 * pipelineTracer — Server-side helper that records the stages a message
 * generation goes through, so the frontend can replay them as animated
 * badges (Contract → Detector → Oracle → Decision → Prompt → AI →
 * Journalist → Ready).
 *
 * Usage:
 *   const tracer = createPipelineTracer();
 *   tracer.start("contract");
 *   ... do work ...
 *   tracer.end("contract", "done", "Contract validato");
 *   ...
 *   return { ..., pipeline_trace: tracer.toArray() };
 */

export type PipelineStageId =
  | "contract"
  | "detector"
  | "oracle"
  | "decision"
  | "prompt"
  | "ai"
  | "journalist"
  | "ready";

export type PipelineStageStatus = "pending" | "running" | "done" | "warn" | "error";

export interface PipelineTraceEntry {
  stage: PipelineStageId;
  status: PipelineStageStatus;
  durationMs?: number;
  detail?: string;
}

export interface PipelineTracer {
  start(stage: PipelineStageId): void;
  end(stage: PipelineStageId, status: PipelineStageStatus, detail?: string): void;
  /** Convenience: mark as done in zero time (for stages that completed before instrumentation). */
  mark(stage: PipelineStageId, status: PipelineStageStatus, detail?: string): void;
  /** Wrap an async fn so start/end are automatic. */
  track<T>(stage: PipelineStageId, fn: () => Promise<T>, detailOnDone?: (v: T) => string | undefined): Promise<T>;
  toArray(): PipelineTraceEntry[];
}

export function createPipelineTracer(): PipelineTracer {
  const entries: PipelineTraceEntry[] = [];
  const inflight = new Map<PipelineStageId, number>();

  return {
    start(stage) {
      inflight.set(stage, Date.now());
      entries.push({ stage, status: "running" });
    },
    end(stage, status, detail) {
      const startedAt = inflight.get(stage);
      const durationMs = startedAt ? Date.now() - startedAt : undefined;
      inflight.delete(stage);
      // Replace last "running" entry for this stage if present
      for (let i = entries.length - 1; i >= 0; i--) {
        if (entries[i].stage === stage && entries[i].status === "running") {
          entries[i] = { stage, status, durationMs, detail };
          return;
        }
      }
      entries.push({ stage, status, durationMs, detail });
    },
    mark(stage, status, detail) {
      entries.push({ stage, status, detail });
    },
    async track(stage, fn, detailOnDone) {
      this.start(stage);
      try {
        const v = await fn();
        this.end(stage, "done", detailOnDone?.(v));
        return v;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.end(stage, "error", msg.slice(0, 160));
        throw err;
      }
    },
    toArray() {
      return [...entries];
    },
  };
}