/**
 * useHarmonizeOrchestrator — hook che pilota l'intero flusso di "Armonizza tutto".
 *
 * Fasi:
 *  1. collecting  → carica DB reale + libreria + classifica gap
 *  2. analyzing   → invoca Harmonizer LLM, persistenza incrementale proposte
 *  3. review      → utente approva/modifica/rifiuta
 *  4. executing   → esegue solo le approved
 *  5. done | failed | cancelled
 */
import { useCallback, useState } from "react";
import { runHarmonizeCollector, type CollectorOutput } from "./harmonizeCollector";
import { runHarmonizeAnalyzer } from "./harmonizeAnalyzer";
import { executeProposal } from "./harmonizeExecutor";
import {
  createHarmonizeRun,
  updateHarmonizeRun,
  appendHarmonizeProposal,
  setProposalStatus,
  cancelHarmonizeRun,
  type HarmonizeRun,
  type HarmonizeProposal,
} from "@/data/harmonizeRuns";
import type { ParsedFile } from "../utils/fileParser";

export type HarmonizePhase =
  | "idle"
  | "collecting"
  | "analyzing"
  | "review"
  | "executing"
  | "done"
  | "cancelled"
  | "failed";

export interface HarmonizeOrchestratorState {
  phase: HarmonizePhase;
  loading: boolean;
  runId?: string;
  proposals: HarmonizeProposal[];
  approvedIds: Set<string>;
  collector?: CollectorOutput;
  progress: { current: number; total: number };
  error?: string;
  executedCount: number;
  failedCount: number;
}

const INITIAL: HarmonizeOrchestratorState = {
  phase: "idle",
  loading: false,
  proposals: [],
  approvedIds: new Set(),
  progress: { current: 0, total: 0 },
  executedCount: 0,
  failedCount: 0,
};

export function useHarmonizeOrchestrator(userId: string) {
  const [state, setState] = useState<HarmonizeOrchestratorState>(INITIAL);

  const start = useCallback(
    async (params: { goal: string; librarySource: string; uploadedFiles: ParsedFile[] }) => {
      if (!userId) return;
      setState({ ...INITIAL, phase: "collecting", loading: true });

      let run: HarmonizeRun;
      try {
        run = await createHarmonizeRun(userId, params.goal);
      } catch (e) {
        setState((s) => ({ ...s, phase: "failed", loading: false, error: e instanceof Error ? e.message : "Errore creazione run" }));
        return;
      }

      try {
        // FASE 1 — COLLECT
        const collector = await runHarmonizeCollector(userId, params.librarySource, params.uploadedFiles);
        await updateHarmonizeRun(run.id, {
          status: "analyzing",
          real_inventory_summary: collector.realSummary,
          desired_inventory_summary: collector.desiredSummary,
          gap_classification: collector.classification,
          uploaded_files: params.uploadedFiles.map((f) => ({ name: f.name, size: f.sizeKb })),
        });
        setState((s) => ({ ...s, phase: "analyzing", runId: run.id, collector }));

        // FASE 2 — ANALYZE (incrementale)
        const proposals: HarmonizeProposal[] = [];
        await runHarmonizeAnalyzer(
          collector,
          async (p) => {
            proposals.push(p);
            try { await appendHarmonizeProposal(run.id, p); } catch { /* skip persist err */ }
            setState((s) => ({ ...s, proposals: [...proposals] }));
          },
          (current, total) => setState((s) => ({ ...s, progress: { current, total } })),
        );

        await updateHarmonizeRun(run.id, { status: "review" });
        setState((s) => ({ ...s, phase: "review", loading: false }));
      } catch (e) {
        await updateHarmonizeRun(run.id, { status: "failed" }).catch(() => {});
        setState((s) => ({ ...s, phase: "failed", loading: false, error: e instanceof Error ? e.message : "Errore analisi" }));
      }
    },
    [userId],
  );

  const toggleApproval = useCallback((proposalId: string) => {
    setState((s) => {
      const next = new Set(s.approvedIds);
      if (next.has(proposalId)) next.delete(proposalId);
      else next.add(proposalId);
      return { ...s, approvedIds: next };
    });
  }, []);

  const approveAllSafe = useCallback(() => {
    setState((s) => {
      const next = new Set(s.approvedIds);
      for (const p of s.proposals) {
        const safe =
          p.resolution_layer === "text" &&
          p.action !== "DELETE" &&
          p.impact !== "high" &&
          !(p.action === "INSERT" && p.target.table === "agents");
        if (safe) next.add(p.id);
      }
      return { ...s, approvedIds: next };
    });
  }, []);

  const execute = useCallback(async () => {
    if (!state.runId) return;
    setState((s) => ({ ...s, phase: "executing", loading: true }));
    await updateHarmonizeRun(state.runId, { status: "executing" }).catch(() => {});

    let executed = 0;
    let failed = 0;
    const approved = state.proposals.filter((p) => state.approvedIds.has(p.id));
    for (const p of approved) {
      const res = await executeProposal(userId, p);
      if (res.ok) {
        executed++;
        await setProposalStatus(state.runId, p.id, "executed").catch(() => {});
      } else {
        failed++;
        await setProposalStatus(state.runId, p.id, "failed", res.reason).catch(() => {});
      }
      setState((s) => ({ ...s, executedCount: executed, failedCount: failed }));
    }

    await updateHarmonizeRun(state.runId, {
      status: "done",
      completed_at: new Date().toISOString(),
    }).catch(() => {});
    setState((s) => ({ ...s, phase: "done", loading: false }));
  }, [state.runId, state.proposals, state.approvedIds, userId]);

  const cancel = useCallback(async () => {
    if (state.runId) await cancelHarmonizeRun(state.runId).catch(() => {});
    setState({ ...INITIAL, phase: "cancelled" });
  }, [state.runId]);

  const reset = useCallback(() => setState(INITIAL), []);

  return { state, start, toggleApproval, approveAllSafe, execute, cancel, reset };
}