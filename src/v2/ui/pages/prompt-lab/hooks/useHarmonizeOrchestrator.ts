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
import { runHarmonizeAnalyzer, type AnalyzerContext } from "./harmonizeAnalyzer";
import { executeProposal } from "./harmonizeExecutor";
import { supabase } from "@/integrations/supabase/client";
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
        const analyzerCtx: AnalyzerContext = {
          goal: params.goal,
          operatorId: userId,
          language: "it",
          mode: "first_run",
        };
        await runHarmonizeAnalyzer(
          collector,
          async (p) => {
            proposals.push(p);
            try { await appendHarmonizeProposal(run.id, p); } catch { /* skip persist err */ }
            setState((s) => ({ ...s, proposals: [...proposals] }));
          },
          (current, total) => setState((s) => ({ ...s, progress: { current, total } })),
          analyzerCtx,
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
      else {
        // Cabling dipendenze: approvabile solo se TUTTE le dipendenze sono già approvate.
        const proposal = s.proposals.find((p) => p.id === proposalId);
        const deps = proposal?.dependencies ?? [];
        const missing = deps.filter((d) => !next.has(d));
        if (missing.length > 0) {
          console.warn("[harmonize] Cannot approve: missing dependency approvals", missing);
          return s; // no-op
        }
        next.add(proposalId);
      }
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
      const res = await executeProposal(userId, p, state.runId);
      if (res.ok) {
        executed++;
        await setProposalStatus(state.runId, p.id, "executed").catch(() => {});
        // Loop di apprendimento: per agents/agent_personas crea verifica post-armonizzazione.
        if (p.target.table === "agents" && p.target.id) {
          try {
            await supabase.from("agent_tasks").insert({
              agent_id: p.target.id,
              user_id: userId,
              task_type: "harmonize_verification",
              description: `Verifica comportamento post-armonizzazione: ${p.block_label ?? p.reasoning.slice(0, 80)}`,
              status: "pending",
              target_filters: { harmonize_run_id: state.runId, proposal_id: p.id } as never,
            } as never);
          } catch (e) {
            console.warn("[harmonize] agent_task creation failed", e);
          }
        }
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