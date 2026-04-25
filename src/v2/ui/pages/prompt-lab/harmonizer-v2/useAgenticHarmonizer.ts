/**
 * useAgenticHarmonizer — Hook React per la pipeline Armonizzatore V2.
 */
import { useCallback, useRef, useState } from "react";
import { runAgenticHarmonizer, type EntityProgress, type OrchestratorOutput, type OrchestratorStats, type OrchestratorWarning } from "./agentOrchestrator";
import type { ParsedFile } from "../utils/fileParser";

export type AgenticPhase = "idle" | "parsing" | "indexing" | "processing" | "reviewing" | "done" | "error" | "cancelled";

export interface AgenticState {
  phase: AgenticPhase;
  entities: EntityProgress[];
  currentIndex: number;
  total: number;
  stats?: OrchestratorStats;
  warnings: OrchestratorWarning[];
  output?: OrchestratorOutput;
  error?: string;
}

const INITIAL: AgenticState = {
  phase: "idle",
  entities: [],
  currentIndex: 0,
  total: 0,
  warnings: [],
};

export function useAgenticHarmonizer(userId: string) {
  const [state, setState] = useState<AgenticState>(INITIAL);
  const abortRef = useRef(false);

  const start = useCallback(async (input: { sourceFile: ParsedFile; goal: string }) => {
    if (!userId) return;
    abortRef.current = false;
    setState({ ...INITIAL, phase: "parsing" });
    try {
      const output = await runAgenticHarmonizer({
        userId,
        sourceText: input.sourceFile.content,
        sourceFileName: input.sourceFile.name,
        goal: input.goal,
        callbacks: {
          onPhaseChange: (phase) => setState((s) => ({ ...s, phase })),
          onEntityProgress: (entity, idx, total) => {
            setState((s) => {
              const entities = s.entities.length === total ? [...s.entities] : new Array(total).fill(null).map((_, i) => s.entities[i] ?? entity);
              entities[idx] = entity;
              return { ...s, entities, currentIndex: idx, total };
            });
          },
          shouldAbort: () => abortRef.current,
        },
      });
      setState((s) => ({ ...s, phase: "done", entities: output.entities, stats: output.stats, warnings: output.warnings, output, total: output.entities.length }));
    } catch (err) {
      setState((s) => ({ ...s, phase: "error", error: err instanceof Error ? err.message : String(err) }));
    }
  }, [userId]);

  const cancel = useCallback(() => {
    abortRef.current = true;
    setState((s) => ({ ...s, phase: "cancelled" }));
  }, []);

  const reset = useCallback(() => {
    abortRef.current = false;
    setState(INITIAL);
  }, []);

  return { state, start, cancel, reset };
}
