/**
 * useHarmonizeOrchestrator — hook che pilota l'intero flusso di "Armonizza tutto".
 *
 * Fasi:
 *  1. collecting  → carica DB reale + libreria + classifica gap
 *  2. analyzing   → invoca Harmonizer LLM, persistenza incrementale proposte
 *  3. review      → utente approva/modifica/rifiuta
 *  4. executing   → esegue solo le approved
 *  5. done | failed | cancelled
 *
 * PERSISTENZA: lo state viene salvato in localStorage dopo ogni transizione,
 * così un refresh accidentale non perde l'inventario raccolto, le proposte
 * generate dall'analyzer e le selezioni dell'utente.
 */
import { useCallback, useEffect, useState } from "react";
import { runHarmonizeCollector, type CollectorOutput } from "./harmonizeCollector";
import { runHarmonizeAnalyzer, type AnalyzerContext } from "./harmonizeAnalyzer";
import { executeProposal } from "./harmonizeExecutor";
import { supabase } from "@/integrations/supabase/client";
import {
  createHarmonizeRun,
  updateHarmonizeRun,
  appendHarmonizeProposal,
  updateHarmonizeProposal,
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

const STORAGE_PREFIX = "harmonizerV2:classic:state:";
const STORAGE_VERSION = 1;

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

function loadPersistedState(userId: string): HarmonizeOrchestratorState | null {
  if (!userId || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { v: number; state: Omit<HarmonizeOrchestratorState, "approvedIds"> & { approvedIds: string[] } };
    if (parsed.v !== STORAGE_VERSION || !parsed.state) return null;
    const restored: HarmonizeOrchestratorState = {
      ...parsed.state,
      approvedIds: new Set(parsed.state.approvedIds ?? []),
      loading: false,
    };
    // Le fasi "in volo" non possono riprendere il loop: degradiamo in modo sicuro.
    if (restored.phase === "collecting" || restored.phase === "analyzing") {
      restored.phase = restored.proposals.length > 0 ? "review" : "cancelled";
    }
    if (restored.phase === "executing") {
      restored.phase = "review";
    }
    return restored;
  } catch {
    return null;
  }
}

function persistState(userId: string, state: HarmonizeOrchestratorState): void {
  if (!userId || typeof window === "undefined") return;
  try {
    if (state.phase === "idle" && state.proposals.length === 0) {
      window.localStorage.removeItem(storageKey(userId));
      return;
    }
    const payload = {
      v: STORAGE_VERSION,
      state: { ...state, approvedIds: Array.from(state.approvedIds) },
    };
    window.localStorage.setItem(storageKey(userId), JSON.stringify(payload));
  } catch {
    // localStorage pieno o disabilitato.
  }
}

export function useHarmonizeOrchestrator(userId: string) {
  const [state, setState] = useState<HarmonizeOrchestratorState>(() => loadPersistedState(userId) ?? INITIAL);

  useEffect(() => {
    const restored = loadPersistedState(userId);
    if (restored) setState(restored);
  }, [userId]);

  useEffect(() => {
    persistState(userId, state);
  }, [userId, state]);

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

  /**
   * Modifica inline il payload di una proposta (campo `after` per UPDATE/INSERT).
   * L'edit viene anche persistito sul run salvato così sopravvive a refresh.
   */
  const editProposalAfter = useCallback(
    async (proposalId: string, newAfter: string): Promise<{ ok: boolean; reason?: string }> => {
      if (!state.runId) return { ok: false, reason: "run mancante" };
      const editedAt = new Date().toISOString();
      try {
        const proposals = await updateHarmonizeProposal(state.runId, proposalId, {
          after: newAfter,
          edited_by_user: true,
          edited_at: editedAt,
        });
        setState((s) => ({ ...s, proposals }));
        return { ok: true };
      } catch (e) {
        const reason = e instanceof Error ? e.message : "salvataggio fallito";
        console.warn("[harmonize] persist edit failed", reason);
        return { ok: false, reason };
      }
    },
    [state.runId],
  );

  const loadRunForReview = useCallback((run: HarmonizeRun) => {
    const proposals = run.proposals ?? [];
    const approvedIds = new Set(
      proposals
        .filter((p) =>
          p.resolution_layer === "text" &&
          p.action !== "DELETE" &&
          p.impact !== "high" &&
          !(p.action === "INSERT" && p.target.table === "agents"),
        )
        .map((p) => p.id),
    );
    setState({
      ...INITIAL,
      phase: "review",
      runId: run.id,
      proposals,
      approvedIds,
      executedCount: run.executed_count ?? 0,
      failedCount: run.failed_count ?? 0,
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

  /**
   * Applica UNA singola proposta al DB e la rimuove dalla lista visibile,
   * così l'utente può continuare con le altre senza toccare le selezioni.
   */
  const executeSingle = useCallback(
    async (proposalId: string): Promise<{ ok: boolean; reason?: string }> => {
      if (!state.runId) return { ok: false, reason: "missing run" };
      const proposal = state.proposals.find((p) => p.id === proposalId);
      if (!proposal) return { ok: false, reason: "proposal not found" };

      const res = await executeProposal(userId, proposal, state.runId);
      if (res.ok) {
        await setProposalStatus(state.runId, proposal.id, "executed").catch(() => {});
        if (proposal.target.table === "agents" && proposal.target.id) {
          try {
            await supabase.from("agent_tasks").insert({
              agent_id: proposal.target.id,
              user_id: userId,
              task_type: "harmonize_verification",
              description: `Verifica comportamento post-armonizzazione: ${proposal.block_label ?? proposal.reasoning.slice(0, 80)}`,
              status: "pending",
              target_filters: { harmonize_run_id: state.runId, proposal_id: proposal.id } as never,
            } as never);
          } catch (e) {
            console.warn("[harmonize] agent_task creation failed", e);
          }
        }
        setState((s) => {
          const proposals = s.proposals.filter((p) => p.id !== proposalId);
          const approvedIds = new Set(s.approvedIds);
          approvedIds.delete(proposalId);
          return {
            ...s,
            proposals,
            approvedIds,
            executedCount: s.executedCount + 1,
          };
        });
      } else {
        await setProposalStatus(state.runId, proposal.id, "failed", res.reason).catch(() => {});
        setState((s) => ({ ...s, failedCount: s.failedCount + 1 }));
      }
      return res;
    },
    [state.runId, state.proposals, userId],
  );

  const cancel = useCallback(async () => {
    if (state.runId) await cancelHarmonizeRun(state.runId).catch(() => {});
    setState({ ...INITIAL, phase: "cancelled" });
  }, [state.runId]);

  const reset = useCallback(() => {
    setState(INITIAL);
    if (userId && typeof window !== "undefined") {
      try { window.localStorage.removeItem(storageKey(userId)); } catch { /* noop */ }
    }
  }, [userId]);

  return { state, start, toggleApproval, approveAllSafe, editProposalAfter, loadRunForReview, execute, executeSingle, cancel, reset };
}