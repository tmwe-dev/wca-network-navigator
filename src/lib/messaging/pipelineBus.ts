/**
 * messagePipelineBus — Singleton EventTarget that broadcasts the live
 * progression of a message generation through its pipeline stages
 * (Contract → Detector → Oracle → Decision → Prompt → AI → Journalist).
 *
 * Producers (invokeAi wrappers, edge-function clients) emit events.
 * Consumers (<MessagePipelineTracker />, overlays) subscribe to render.
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

export interface PipelineStage {
  id: PipelineStageId;
  status: PipelineStageStatus;
  startedAt?: number;
  endedAt?: number;
  durationMs?: number;
  detail?: string;
}

export interface PipelineSnapshot {
  pipelineId: string;
  channel: "email" | "whatsapp" | "linkedin" | "generic";
  surface: string; // e.g. "command", "composer", "cockpit"
  startedAt: number;
  endedAt?: number;
  stages: PipelineStage[];
  finalStatus?: "done" | "warn" | "error";
  label?: string; // human-readable hint, e.g. "Email a 24 partner Arabia Saudita"
}

type StartPayload = Omit<PipelineSnapshot, "stages" | "startedAt"> & {
  stages?: PipelineStageId[];
};

const DEFAULT_STAGES: PipelineStageId[] = [
  "contract",
  "detector",
  "oracle",
  "decision",
  "prompt",
  "ai",
  "journalist",
  "ready",
];

const EVENT_NAME = "message-pipeline";

class MessagePipelineBus extends EventTarget {
  private snapshots = new Map<string, PipelineSnapshot>();

  list(): PipelineSnapshot[] {
    return Array.from(this.snapshots.values()).sort((a, b) => b.startedAt - a.startedAt);
  }

  get(pipelineId: string): PipelineSnapshot | undefined {
    return this.snapshots.get(pipelineId);
  }

  start(payload: StartPayload): PipelineSnapshot {
    const stageIds = payload.stages ?? DEFAULT_STAGES;
    const snapshot: PipelineSnapshot = {
      pipelineId: payload.pipelineId,
      channel: payload.channel,
      surface: payload.surface,
      label: payload.label,
      startedAt: Date.now(),
      stages: stageIds.map((id) => ({ id, status: "pending" })),
    };
    this.snapshots.set(snapshot.pipelineId, snapshot);
    this.emit(snapshot);
    return snapshot;
  }

  update(
    pipelineId: string,
    stageId: PipelineStageId,
    patch: Partial<PipelineStage> & { status: PipelineStageStatus },
  ): void {
    const snap = this.snapshots.get(pipelineId);
    if (!snap) return;
    const idx = snap.stages.findIndex((s) => s.id === stageId);
    if (idx === -1) {
      snap.stages.push({ id: stageId, ...patch });
    } else {
      const prev = snap.stages[idx];
      const next: PipelineStage = { ...prev, ...patch };
      if (patch.status === "running" && !next.startedAt) next.startedAt = Date.now();
      if ((patch.status === "done" || patch.status === "warn" || patch.status === "error") && !next.endedAt) {
        next.endedAt = Date.now();
        if (next.startedAt) next.durationMs = next.endedAt - next.startedAt;
      }
      snap.stages[idx] = next;
    }
    this.emit(snap);
  }

  end(pipelineId: string, finalStatus: "done" | "warn" | "error" = "done"): void {
    const snap = this.snapshots.get(pipelineId);
    if (!snap) return;
    snap.endedAt = Date.now();
    snap.finalStatus = finalStatus;
    // Auto-finalize remaining pending/running stages.
    snap.stages = snap.stages.map((s) =>
      s.status === "pending" || s.status === "running"
        ? { ...s, status: finalStatus === "error" ? "error" : "done", endedAt: Date.now() }
        : s,
    );
    this.emit(snap);
    // Auto-cleanup after 30s so the overlay history stays small.
    setTimeout(() => {
      this.snapshots.delete(pipelineId);
      this.emit(null, pipelineId);
    }, 30_000);
  }

  subscribe(handler: (snap: PipelineSnapshot | null, pipelineId?: string) => void): () => void {
    const listener = (e: Event) => {
      const detail = (e as CustomEvent).detail as { snapshot: PipelineSnapshot | null; pipelineId?: string };
      handler(detail.snapshot, detail.pipelineId);
    };
    this.addEventListener(EVENT_NAME, listener);
    return () => this.removeEventListener(EVENT_NAME, listener);
  }

  private emit(snapshot: PipelineSnapshot | null, pipelineId?: string) {
    this.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { snapshot, pipelineId } }));
  }
}

export const messagePipelineBus = new MessagePipelineBus();

/**
 * Generate a short pipeline ID. Not cryptographically secure — only for UI keys.
 */
export function newPipelineId(): string {
  return `pl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Replay a server-side pipeline trace progressively to keep the "moving paper"
 * effect even when the backend returns the trace in one shot.
 */
export async function replayServerTrace(
  pipelineId: string,
  trace: Array<{ stage: PipelineStageId; status: PipelineStageStatus; durationMs?: number; detail?: string }>,
  stepDelayMs = 90,
): Promise<void> {
  for (const step of trace) {
    messagePipelineBus.update(pipelineId, step.stage, {
      status: step.status,
      durationMs: step.durationMs,
      detail: step.detail,
    });
    await new Promise((r) => setTimeout(r, stepDelayMs));
  }
}