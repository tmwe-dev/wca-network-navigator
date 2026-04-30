/**
 * useMessagePipeline — Reactive subscription to the messagePipelineBus.
 *
 * - Without args: returns ALL active pipeline snapshots (for the global overlay).
 * - With pipelineId: returns just that snapshot (for inline contextual trackers).
 */
import { useEffect, useState } from "react";
import { messagePipelineBus, type PipelineSnapshot } from "@/lib/messaging/pipelineBus";

export function useMessagePipeline(): PipelineSnapshot[];
export function useMessagePipeline(pipelineId: string | null | undefined): PipelineSnapshot | null;
export function useMessagePipeline(pipelineId?: string | null): PipelineSnapshot | null | PipelineSnapshot[] {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const unsub = messagePipelineBus.subscribe(() => setTick((n) => n + 1));
    return unsub;
  }, []);

  // Re-evaluate on every emit
  void tick;

  if (typeof pipelineId === "undefined") {
    return messagePipelineBus.list();
  }
  if (!pipelineId) return null;
  return messagePipelineBus.get(pipelineId) ?? null;
}