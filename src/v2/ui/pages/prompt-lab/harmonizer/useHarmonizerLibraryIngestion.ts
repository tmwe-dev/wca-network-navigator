/**
 * useHarmonizerLibraryIngestion — hook orchestratore per la pipeline 7-chunk
 * di ingestione documenti grandi (es. libreria TMWE).
 *
 * Flusso:
 *  1. Crea harmonizer_sessions row + harmonize_runs figlio.
 *  2. Loop su TMWE_EXECUTION_ORDER: collector → analyzer → persistenza.
 *  3. Aggiorna sessionState dopo ogni chunk (facts, conflicts, entities, cross_refs).
 *  4. A fine pipeline → completeSession + status=review sul run figlio.
 *  5. Su errore in un chunk: salva in errors, NON avanza, retryChunk() idempotente.
 */
import { useCallback, useEffect, useState } from "react";
import {
  createHarmonizerSession,
  loadHarmonizerSession,
  appendFacts,
  appendConflicts,
  appendCrossReferences,
  appendEntities,
  advanceChunk,
  markSessionError,
  completeHarmonizerSession,
  cancelHarmonizerSession,
  findActiveHarmonizerSession,
  type HarmonizerSession,
} from "@/data/harmonizerSessions";
import {
  createHarmonizeRun,
  updateHarmonizeRun,
  appendHarmonizeProposal,
  type HarmonizeRun,
} from "@/data/harmonizeRuns";
import { TMWE_CHUNKS, TMWE_EXECUTION_ORDER, type TmweChunkDef } from "./tmweChunks";
import { runLibraryChunkCollector } from "./harmonizerLibraryCollector";
import { runLibraryChunkAnalyzer, type LibraryAnalyzerOutput } from "./harmonizerLibraryAnalyzer";
import type { ParsedFile } from "../utils/fileParser";
import { collectRealInventory } from "../hooks/harmonizeCollector";
import type { EntityCreatedEntry } from "@/data/harmonizerSessions";


import { createLogger } from "@/lib/log";
const log = createLogger("useHarmonizerLibraryIngestion");
export type IngestionPhase =
  | "idle"
  | "starting"
  | "running"
  | "review"
  | "completed"
  | "error"
  | "cancelled";

export interface ChunkProgress {
  chunkIndex: number;
  chunkName: string;
  status: "pending" | "running" | "completed" | "error";
  proposals: number;
  facts: number;
  conflicts: number;
  entities: number;
  errorMsg?: string;
}

export interface IngestionState {
  phase: IngestionPhase;
  loading: boolean;
  session?: HarmonizerSession;
  run?: HarmonizeRun;
  chunks: ChunkProgress[];
  totalProposals: number;
  resumable?: HarmonizerSession;
  error?: string;
}

const INITIAL: IngestionState = {
  phase: "idle",
  loading: false,
  chunks: TMWE_CHUNKS.map((c) => ({
    chunkIndex: c.index,
    chunkName: c.name,
    status: "pending",
    proposals: 0,
    facts: 0,
    conflicts: 0,
    entities: 0,
  })),
  totalProposals: 0,
};

/**
 * Pre-popola entities_created leggendo TUTTE le righe attive del DB nelle
 * tabelle target unite di tutti i chunk. Così, dal chunk #0, il modello
 * "sa" cosa esiste e propone UPDATE invece di INSERT spuri.
 *
 * Marker: created_in_chunk = -1 → significa "preesistente al run".
 */
async function bootstrapEntitiesFromDb(userId: string): Promise<EntityCreatedEntry[]> {
  try {
    const allTargetTables = new Set<string>();
    for (const c of TMWE_CHUNKS) for (const t of c.targetTables) allTargetTables.add(t);
    const real = await collectRealInventory(userId);
    // Cap a 80 entità preesistenti totali: oltre questa soglia il payload
    // session.entities_created saturava il prompt del modello in chunk #0.
    return real
      .filter((i) => allTargetTables.has(i.table))
      .slice(0, 80)
      .map((i) => ({
        table: i.table,
        id: i.id,
        title: i.title,
        created_in_chunk: -1, // preesistente
      }));
  } catch (e) {
    log.warn("[ingestion] bootstrap entities failed, proceeding empty", { error: e });
    return [];
  }
}

export function useHarmonizerLibraryIngestion(userId: string) {
  const [state, setState] = useState<IngestionState>(INITIAL);

  // ── Detect sessione ripresabile all'avvio ──
  useEffect(() => {
    if (!userId) return;
    findActiveHarmonizerSession(userId)
      .then((s) => {
        if (s) setState((prev) => ({ ...prev, resumable: s }));
      })
      .catch(() => { /* ignore */ });
  }, [userId]);

  /** Aggiorna lo stato di un singolo chunk nel progress array. */
  const patchChunk = useCallback((idx: number, patch: Partial<ChunkProgress>) => {
    setState((s) => ({
      ...s,
      chunks: s.chunks.map((c) => (c.chunkIndex === idx ? { ...c, ...patch } : c)),
    }));
  }, []);

  /** Esegue UN chunk. Restituisce true se ok, false se errore. */
  const processChunk = useCallback(
    async (
      chunkDef: TmweChunkDef,
      sourceText: string,
      sessionId: string,
      runId: string,
      goal: string,
    ): Promise<{ ok: boolean; output?: LibraryAnalyzerOutput; error?: string }> => {
      patchChunk(chunkDef.index, { status: "running" });
      try {
        const session = await loadHarmonizerSession(sessionId);
        if (!session) throw new Error("session disappeared mid-run");

        const collector = await runLibraryChunkCollector({
          userId,
          sourceText,
          chunkDef,
          session,
        });

        const output = await runLibraryChunkAnalyzer({
          collector,
          chunkDef,
          session,
          goal,
        });

        // Persisti proposte sul run figlio.
        for (const p of output.proposals) {
          await appendHarmonizeProposal(runId, p).catch((e) => {
            log.warn("[ingestion] appendHarmonizeProposal failed", { error: e });
          });
        }

        // Aggiorna sessionState.
        if (output.extractedFacts.length) await appendFacts(sessionId, output.extractedFacts);
        if (output.newConflicts.length) await appendConflicts(sessionId, output.newConflicts);
        if (output.newCrossRefs.length) await appendCrossReferences(sessionId, output.newCrossRefs);
        if (output.entitiesCreated.length) await appendEntities(sessionId, output.entitiesCreated);

        await advanceChunk(sessionId, chunkDef.index + 1);

        patchChunk(chunkDef.index, {
          status: "completed",
          proposals: output.proposals.length,
          facts: output.extractedFacts.length,
          conflicts: output.newConflicts.length,
          entities: output.entitiesCreated.length,
        });
        setState((s) => ({ ...s, totalProposals: s.totalProposals + output.proposals.length }));

        return { ok: true, output };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await markSessionError(sessionId, {
          chunk_index: chunkDef.index,
          message: msg,
          occurred_at: new Date().toISOString(),
        }).catch(() => {});
        patchChunk(chunkDef.index, { status: "error", errorMsg: msg });
        return { ok: false, error: msg };
      }
    },
    [userId, patchChunk],
  );

  /** Avvia la pipeline completa. */
  const start = useCallback(
    async (input: { sourceFile: ParsedFile; goal: string }) => {
      if (!userId) return;
      setState({ ...INITIAL, phase: "starting", loading: true });

      let session: HarmonizerSession;
      let run: HarmonizeRun;
      try {
        run = await createHarmonizeRun(userId, input.goal, "library_ingestion");
        const bootstrap = await bootstrapEntitiesFromDb(userId);
        session = await createHarmonizerSession({
          userId,
          sourceFile: input.sourceFile.name,
          sourceKind: "library",
          totalChunks: TMWE_CHUNKS.length,
          harmonizeRunId: run.id,
          bootstrapEntities: bootstrap,
        });
      } catch (e) {
        setState((s) => ({ ...s, phase: "error", loading: false, error: e instanceof Error ? e.message : String(e) }));
        return;
      }

      setState((s) => ({ ...s, session, run, phase: "running" }));
      await updateHarmonizeRun(run.id, { status: "analyzing" }).catch(() => {});

      // Loop nell'ordine di esecuzione raccomandato.
      let firstError: string | undefined;
      for (const idx of TMWE_EXECUTION_ORDER) {
        const chunkDef = TMWE_CHUNKS[idx];
        if (!chunkDef) continue;
        const result = await processChunk(chunkDef, input.sourceFile.content, session.id, run.id, input.goal);
        if (!result.ok) {
          firstError = result.error;
          // Stop alla prima failure (l'utente può chiamare retryChunk).
          break;
        }
      }

      // Reload session state aggiornata.
      const refreshed = await loadHarmonizerSession(session.id).catch(() => session);

      if (firstError) {
        setState((s) => ({ ...s, loading: false, phase: "error", error: firstError, session: refreshed ?? s.session }));
      } else {
        await completeHarmonizerSession(session.id).catch(() => {});
        await updateHarmonizeRun(run.id, { status: "review" }).catch(() => {});
        setState((s) => ({ ...s, loading: false, phase: "review", session: refreshed ?? s.session }));
      }
    },
    [userId, processChunk],
  );

  /** Ritenta UN chunk fallito (idempotente). */
  const retryChunk = useCallback(
    async (chunkIdx: number, sourceText: string, goal: string) => {
      if (!state.session || !state.run) return;
      const chunkDef = TMWE_CHUNKS[chunkIdx];
      if (!chunkDef) return;
      setState((s) => ({ ...s, loading: true, phase: "running", error: undefined }));
      const r = await processChunk(chunkDef, sourceText, state.session.id, state.run.id, goal);
      const refreshed = await loadHarmonizerSession(state.session.id).catch(() => state.session);
      if (!r.ok) {
        setState((s) => ({ ...s, loading: false, phase: "error", error: r.error, session: refreshed ?? s.session }));
      } else {
        setState((s) => ({ ...s, loading: false, phase: "review", session: refreshed ?? s.session }));
      }
    },
    [state.session, state.run, processChunk],
  );

  /** Annulla la sessione corrente o ripresabile. */
  const cancel = useCallback(async () => {
    const sid = state.session?.id ?? state.resumable?.id;
    if (!sid) return;
    await cancelHarmonizerSession(sid).catch(() => {});
    setState({ ...INITIAL, phase: "cancelled" });
  }, [state.session, state.resumable]);

  /** Riprende una sessione interrotta (richiede di ricaricare il file sorgente). */
  const resume = useCallback(
    async (sourceFile: ParsedFile, goal: string) => {
      if (!state.resumable) return;
      const session = state.resumable;
      setState((s) => ({
        ...s,
        loading: true,
        phase: "running",
        session,
        chunks: TMWE_CHUNKS.map((c) => ({
          chunkIndex: c.index,
          chunkName: c.name,
          status: c.index < session.current_chunk ? "completed" : "pending",
          proposals: 0,
          facts: 0,
          conflicts: 0,
          entities: 0,
        })),
      }));

      // Reload run figlio (se esiste).
      let runId = session.harmonize_run_id;
      if (!runId) {
        const r = await createHarmonizeRun(userId, goal, "library_ingestion");
        runId = r.id;
        await updateHarmonizeRun(r.id, { status: "analyzing" }).catch(() => {});
        setState((s) => ({ ...s, run: r }));
      }

      let firstError: string | undefined;
      // Riprendi dai chunk non ancora processati nell'ordine standard.
      const remaining = TMWE_EXECUTION_ORDER.filter((idx) => idx >= session.current_chunk);
      for (const idx of remaining) {
        const chunkDef = TMWE_CHUNKS[idx];
        if (!chunkDef) continue;
        const r = await processChunk(chunkDef, sourceFile.content, session.id, runId, goal);
        if (!r.ok) { firstError = r.error; break; }
      }

      const refreshed = await loadHarmonizerSession(session.id).catch(() => session);
      if (firstError) {
        setState((s) => ({ ...s, loading: false, phase: "error", error: firstError, session: refreshed ?? s.session }));
      } else {
        await completeHarmonizerSession(session.id).catch(() => {});
        if (runId) await updateHarmonizeRun(runId, { status: "review" }).catch(() => {});
        setState((s) => ({ ...s, loading: false, phase: "review", session: refreshed ?? s.session }));
      }
    },
    [state.resumable, userId, processChunk],
  );

  const dismissResumable = useCallback(() => {
    setState((s) => ({ ...s, resumable: undefined }));
  }, []);

  return {
    state,
    start,
    resume,
    retryChunk,
    cancel,
    dismissResumable,
  };
}
