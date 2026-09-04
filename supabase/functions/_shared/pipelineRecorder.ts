/**
 * pipelineRecorder — registratore leggero dei passaggi di una pipeline edge.
 *
 * Serve a rendere visibile nella Trace Console (frontend) la sequenza reale
 * degli step eseguiti lato server (contract, context, decision engine, prompt,
 * LLM, journalist review) con esito, durata e sintesi del risultato.
 *
 * Fail-safe: non lancia mai, non modifica il flusso della pipeline.
 */

export type PipelineStepStatus = "success" | "skipped" | "warning" | "error";

export interface PipelineStep {
  index: number;
  key: string;
  label: string;
  status: PipelineStepStatus;
  duration_ms: number;
  /** sintesi leggibile del risultato dello step */
  summary?: Record<string, unknown>;
  note?: string;
}

export interface PipelineTrace {
  pipeline: string;
  started_at: string;
  total_ms: number;
  steps: PipelineStep[];
}

const MAX_SUMMARY_BYTES = 2000;

function safeSummary(value?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!value) return undefined;
  try {
    const json = JSON.stringify(value);
    if (json.length <= MAX_SUMMARY_BYTES) return JSON.parse(json) as Record<string, unknown>;
    return { _truncated: true, preview: json.slice(0, MAX_SUMMARY_BYTES) };
  } catch {
    return { _unserializable: true };
  }
}

export class PipelineRecorder {
  private steps: PipelineStep[] = [];
  private readonly t0 = Date.now();
  private lastMark = Date.now();

  constructor(private readonly pipeline: string) {}

  /** Registra uno step concluso; la durata è misurata dall'ultimo step. */
  step(
    key: string,
    label: string,
    status: PipelineStepStatus,
    summary?: Record<string, unknown>,
    note?: string,
  ): void {
    try {
      const now = Date.now();
      this.steps.push({
        index: this.steps.length + 1,
        key,
        label,
        status,
        duration_ms: now - this.lastMark,
        summary: safeSummary(summary),
        note,
      });
      this.lastMark = now;
    } catch {
      /* fail-safe */
    }
  }

  /** Esegue una funzione misurandola e registrandola come step. */
  async track<T>(
    key: string,
    label: string,
    fn: () => Promise<T>,
    summarize?: (result: T) => Record<string, unknown>,
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      this.lastMark = start;
      this.step(key, label, "success", summarize ? summarize(result) : undefined);
      return result;
    } catch (err) {
      this.lastMark = start;
      this.step(key, label, "error", undefined, err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  toJSON(): PipelineTrace {
    return {
      pipeline: this.pipeline,
      started_at: new Date(this.t0).toISOString(),
      total_ms: Date.now() - this.t0,
      steps: this.steps,
    };
  }
}
