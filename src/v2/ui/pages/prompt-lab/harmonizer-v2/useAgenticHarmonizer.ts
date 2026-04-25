/**
 * useAgenticHarmonizer — Hook React per la pipeline Armonizzatore V2.
 *
 * PERSISTENZA: lo state viene salvato in localStorage dopo ogni transizione,
 * così un refresh accidentale della pagina non perde il lavoro fatto
 * (entità processate, stats, runId del DB su cui sono già salvate le proposte).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { runAgenticHarmonizer, type EntityProgress, type OrchestratorOutput, type OrchestratorStats, type OrchestratorWarning } from "./agentOrchestrator";
import { parseEntities } from "./entityParser";
import type { ParsedFile } from "../utils/fileParser";

export type AgenticPhase = "idle" | "parsing" | "indexing" | "processing" | "reviewing" | "done" | "error" | "cancelled";

export interface AgenticState {
  phase: AgenticPhase;
  entities: EntityProgress[];
  processedEntityIds: string[];
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
  processedEntityIds: [],
  currentIndex: 0,
  total: 0,
  warnings: [],
};

const STORAGE_PREFIX = "harmonizerV2:agentic:state:";
const STORAGE_VERSION = 1;

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

function loadPersistedState(userId: string): AgenticState | null {
  if (!userId || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { v: number; state: AgenticState };
    if (parsed.v !== STORAGE_VERSION || !parsed.state) return null;
    // Se al refresh era ancora "in corso", normalizziamo a cancelled (non possiamo
    // riprendere il loop AI: i risultati parziali restano visibili).
    const inFlight = ["parsing", "indexing", "processing", "reviewing"].includes(parsed.state.phase);
    return inFlight ? { ...parsed.state, phase: "cancelled" } : parsed.state;
  } catch {
    return null;
  }
}

function persistState(userId: string, state: AgenticState): void {
  if (!userId || typeof window === "undefined") return;
  try {
    // Non persistere lo stato idle vuoto (è il default).
    if (state.phase === "idle" && state.entities.length === 0) {
      window.localStorage.removeItem(storageKey(userId));
      return;
    }
    window.localStorage.setItem(
      storageKey(userId),
      JSON.stringify({ v: STORAGE_VERSION, state }),
    );
  } catch {
    // localStorage pieno o disabilitato: ignora silenziosamente.
  }
}

export function useAgenticHarmonizer(userId: string) {
  const [state, setState] = useState<AgenticState>(() => loadPersistedState(userId) ?? INITIAL);
  const abortRef = useRef(false);

  // Se l'userId cambia (login/logout), prova a ricaricare lo stato per quel utente.
  useEffect(() => {
    const restored = loadPersistedState(userId);
    if (restored) setState(restored);
  }, [userId]);

  // Persisti ad ogni transizione di stato.
  useEffect(() => {
    persistState(userId, state);
  }, [userId, state]);

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
      const processedEntityIds = output.entities.filter((e) => e.status !== "pending" && e.status !== "processing").map((e) => e.id);
      setState((s) => ({ ...s, phase: "done", entities: output.entities, processedEntityIds, stats: output.stats, warnings: output.warnings, output, total: output.entities.length }));
    } catch (err) {
      setState((s) => ({ ...s, phase: "error", error: err instanceof Error ? err.message : String(err) }));
    }
  }, [userId]);

  const resume = useCallback(async (input: { sourceFile: ParsedFile; goal: string }) => {
    if (!userId) return;
    const restored = state;
    const processedEntityIds = new Set(restored.entities.filter((e) => e.status !== "pending" && e.status !== "processing").map((e) => e.id));
    if (processedEntityIds.size === 0) {
      await start(input);
      return;
    }
    abortRef.current = false;
    try {
      setState((s) => ({ ...s, phase: "parsing" }));
      const parsed = await parseEntities(input.sourceFile.content);
      const remainingIds = new Set(parsed.filter((e) => !processedEntityIds.has(e.id)).map((e) => e.id));
      if (remainingIds.size === 0) {
        setState((s) => ({ ...s, phase: "done" }));
        return;
      }
      const output = await runAgenticHarmonizer({
        userId,
        sourceText: input.sourceFile.content,
        sourceFileName: input.sourceFile.name,
        goal: input.goal,
        resume: {
          runId: restored.output?.runId,
          sessionId: restored.output?.sessionId,
          skipEntityIds: Array.from(processedEntityIds),
          previousEntities: restored.entities,
        },
        callbacks: {
          onPhaseChange: (phase) => setState((s) => ({ ...s, phase })),
          onEntityProgress: (entity, idx, total) => {
            setState((s) => {
              const existingById = new Map(s.entities.map((e) => [e.id, e]));
              const entities = Array.from({ length: total }, (_, i) => s.entities[i] ?? existingById.get(entity.id) ?? entity);
              entities[idx] = entity;
              return { ...s, entities, currentIndex: idx, total };
            });
          },
          shouldAbort: () => abortRef.current,
        },
      });
      setState((s) => ({ ...s, phase: "done", entities: output.entities, processedEntityIds: output.entities.filter((e) => e.status !== "pending" && e.status !== "processing").map((e) => e.id), stats: output.stats, warnings: output.warnings, output, total: output.entities.length }));
    } catch (err) {
      setState((s) => ({ ...s, phase: "error", error: err instanceof Error ? err.message : String(err) }));
    }
  }, [state, start, userId]);

  const cancel = useCallback(() => {
    abortRef.current = true;
    setState((s) => ({ ...s, phase: "cancelled", processedEntityIds: s.entities.filter((e) => e.status !== "pending" && e.status !== "processing").map((e) => e.id) }));
  }, []);

  const reset = useCallback(() => {
    abortRef.current = false;
    setState(INITIAL);
    if (userId && typeof window !== "undefined") {
      try { window.localStorage.removeItem(storageKey(userId)); } catch { /* noop */ }
    }
  }, [userId]);

  return { state, start, resume, cancel, reset };
}
