/**
 * useGlobalPromptImprover — orchestrator del "Migliora tutto" con persistenza (LOVABLE-91).
 *
 * LOVABLE-109: Contesto filtrato per blocco, gerarchia di verità, classificazione esito.
 *
 * Raccoglie TUTTI i blocchi modificabili dal Prompt Lab, costruisce una "system map"
 * + dottrina completa come contesto, e per ogni blocco chiede al Lab Agent una versione
 * migliorata coerente con il resto — filtrando il contesto per rilevanza.
 *
 * Salvataggio è una fase separata (review prima di scrivere su DB).
 *
 * REFACTORED: Splits into focused modules for collection, processing, saving, and context building.
 */
import { useCallback, useState, useEffect, useRef } from "react";
import { useLabAgent, parseImproveResponse } from "./useLabAgent";
import type { Block, BlockSource } from "../types";
import {
  createRun,
  updateRun,
  appendProposal,
  markProposalSaved,
  findActiveRun,
  cancelRun,
  type GlobalRun,
  type GlobalRunProposal,
} from "@/data/promptLabGlobalRuns";
import type { ParsedFile } from "../utils/fileParser";
import { collectAllBlocks, loadFullDoctrine } from "./useBlockCollector";
import { buildSystemMap, buildSystemMapByAgent, toRunProposals, type GlobalProposal } from "./useProposalProcessing";
import { saveProposal, auditSaveProposal } from "./useProposalSaver";
import { buildExtraContext, filterDoctrineForBlock, filterSystemMapForBlock, filterReferenceForBlock } from "./useContextBuilder";

export const SYSTEM_MISSION = `WCA Network Navigator è un CRM/Business Intelligence che gestisce ~12.000 partner logistici WCA.
Gli agenti AI orchestrano outreach multicanale (Email, WhatsApp, LinkedIn) seguendo la dottrina commerciale a 9 stati lead
(new → first_touch_sent → holding → engaged → qualified → negotiation → converted | archived | blacklisted).
Ogni azione passa da gate (blacklist, cadenze multicanale, dottrina di stato) e produce side-effect tracciati (activities, reminders, lead_status).
Obiettivo del sistema: massimizzare risposte qualificate, far avanzare i lead di stato in modo verificabile, mai inventare dati né bypassare governance.`;

export interface GlobalImproverState {
  loading: boolean;
  phase: "idle" | "collecting" | "improving" | "review" | "saving" | "done";
  proposals: GlobalProposal[];
  progress: { current: number; total: number };
  error?: string;
  /** Run ID per persistenza */
  runId?: string;
  /** True se esiste un run ripresabile */
  hasResumableRun: boolean;
  /** Dettagli run ripresabile */
  resumableRun?: GlobalRun;
  /** Contatore salvataggi DB */
  dbSaveCount: number;
}

/** Throttle: salva su DB al massimo ogni 2s (tranne ultimo e errori) */
const DB_THROTTLE_MS = 2000;

export function useGlobalPromptImprover(
  userId: string,
  goal: string,
  referenceMaterial: string = "",
  uploadedFiles: ParsedFile[] = [],
  /**
   * Modalità di raggruppamento del contesto "Blocchi vicini":
   *  - "tab" (default, comportamento storico): vicini = blocchi dello stesso tab UI.
   *  - "agent" (Fase 3 Atlas): vicini = blocchi dello stesso agente runtime.
   * I due rendering della system map sono mutuamente esclusivi nel singolo run.
   */
  contextGrouping: "tab" | "agent" = "tab",
) {
  const lab = useLabAgent();
  const [state, setState] = useState<GlobalImproverState>({
    loading: false,
    phase: "idle",
    proposals: [],
    progress: { current: 0, total: 0 },
    hasResumableRun: false,
    dbSaveCount: 0,
  });
  const lastDbSave = useRef(0);

  // ── Check per run ripresabile all'avvio ──
  useEffect(() => {
    if (!userId) return;
    findActiveRun(userId).then((run) => {
      if (run) {
        setState((s) => ({
          ...s,
          hasResumableRun: true,
          resumableRun: run,
        }));
      }
    }).catch(() => { /* ignore */ });
  }, [userId]);

  const reset = useCallback(() => {
    setState({
      loading: false,
      phase: "idle",
      proposals: [],
      progress: { current: 0, total: 0 },
      hasResumableRun: false,
      dbSaveCount: 0,
    });
  }, []);

  /** Riprende un run dal DB. */
  const resumeRun = useCallback(async () => {
    if (!state.resumableRun) return;
    const run = state.resumableRun;

    // Ricostruisci proposals da DB → Block (servono i blocchi originali per il salvataggio)
    const collected = await collectAllBlocks(userId);
    const proposals: GlobalProposal[] = run.proposals.map((rp) => {
      const found = collected.find((c) => c.block.id === rp.block_id);
      const block: Block = found?.block ?? {
        id: rp.block_id,
        label: rp.label,
        content: rp.before,
        source: rp.source as unknown as BlockSource,
        dirty: false,
      };
      return {
        block,
        tabLabel: rp.tab_label,
        tabActivation: rp.tab_activation,
        before: rp.before,
        after: rp.after,
        status: rp.status as GlobalProposal["status"],
        error: rp.error,
      };
    });

    // Se in review → mostra direttamente le proposte
    if (run.status === "review") {
      setState({
        loading: false,
        phase: "review",
        proposals,
        progress: { current: run.progress_total, total: run.progress_total },
        runId: run.id,
        hasResumableRun: false,
        dbSaveCount: run.progress_current,
      });
      return;
    }

    // Se in improving → riprendi dal punto in cui era
    const startFrom = run.progress_current;
    setState({
      loading: true,
      phase: "improving",
      proposals,
      progress: { current: startFrom, total: run.progress_total },
      runId: run.id,
      hasResumableRun: false,
      dbSaveCount: startFrom,
    });

    const systemMap = run.system_map;
    const doctrineFull = run.doctrine_full;

    for (let i = startFrom; i < proposals.length; i++) {
      const p = proposals[i];
      if (p.status !== "pending") continue; // già processato

      setState((s) => ({
        ...s,
        progress: { ...s.progress, current: i },
        proposals: s.proposals.map((x, idx) => (idx === i ? { ...x, status: "improving" } : x)),
      }));

      try {
        // LOVABLE-109: Contesto filtrato per blocco — riduce rumore e token
        const filteredDoctrine = filterDoctrineForBlock(doctrineFull, p.block, p.tabLabel);
        const filteredMap = filterSystemMapForBlock(collected, p.block, p.tabLabel);

        const rawImproved = await lab.improveBlockGlobal({
          block: p.block,
          tabLabel: p.tabLabel,
          tabActivation: p.tabActivation,
          systemMap: filteredMap,
          doctrineFull: filteredDoctrine,
          systemMission: SYSTEM_MISSION,
          goal: run.goal || undefined,
        });

        // LOVABLE-109: Parse outcome_type e architectural note dalla risposta
        const parsed = parseImproveResponse(rawImproved);
        const isSame = parsed.text.trim() === p.before.trim();
        const newStatus = (isSame || parsed.outcomeType === "no_change") ? "skipped" as const : "ready" as const;

        setState((s) => ({
          ...s,
          proposals: s.proposals.map((x, idx) =>
            idx === i ? {
              ...x,
              after: parsed.text,
              status: newStatus,
              outcomeType: parsed.outcomeType,
              architecturalNote: parsed.architecturalNote,
            } : x,
          ),
        }));

        // Persist to DB
        await appendProposal(run.id, i, { after: parsed.text, status: newStatus }, i + 1);
        setState((s) => ({ ...s, dbSaveCount: s.dbSaveCount + 1 }));
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        setState((s) => ({
          ...s,
          proposals: s.proposals.map((x, idx) =>
            idx === i ? { ...x, status: "error", error: errMsg } : x,
          ),
        }));
        await appendProposal(run.id, i, { status: "error", error: errMsg }, i + 1).catch(() => {});
      }
      // Pausa anti-saturazione del pool isolate (vedi commento in startImprovement).
      if (i < proposals.length - 1) {
        await new Promise((r) => setTimeout(r, 250));
      }
    }

    await updateRun(run.id, { status: "review", progress_current: proposals.length });
    setState((s) => ({
      ...s,
      loading: false,
      phase: "review",
      progress: { current: proposals.length, total: proposals.length },
    }));
  }, [state.resumableRun, userId, lab]);

  /** Cancella un run ripresabile. */
  const dismissResumable = useCallback(async () => {
    if (state.resumableRun) {
      await cancelRun(state.resumableRun.id).catch(() => {});
    }
    setState((s) => ({ ...s, hasResumableRun: false, resumableRun: undefined }));
  }, [state.resumableRun]);

  /** Step 1+2: raccoglie e migliora tutti i blocchi con persistenza incrementale. */
  const startImprovement = useCallback(async () => {
    if (!userId) return;
    setState((s) => ({ ...s, loading: true, phase: "collecting", proposals: [], progress: { current: 0, total: 0 }, error: undefined, dbSaveCount: 0 }));

    let collected: Array<{ tabLabel: string; block: Block }> = [];
    let doctrineFull = "";
    let systemMap = "";
    let extraContext = "";

    try {
      collected = await collectAllBlocks(userId);
      doctrineFull = await loadFullDoctrine();
      systemMap = contextGrouping === "agent"
        ? buildSystemMapByAgent(collected)
        : buildSystemMap(collected);
      extraContext = await buildExtraContext(userId, referenceMaterial, uploadedFiles);
    } catch (e) {
      setState((s) => ({ ...s, loading: false, phase: "idle", error: e instanceof Error ? e.message : String(e) }));
      return;
    }

    // Arricchisci la doctrine con il contesto extra
    const fullContext = doctrineFull + extraContext;

    const initial: GlobalProposal[] = collected.map(({ tabLabel, block }) => ({
      block,
      tabLabel,
      before: block.content,
      status: "pending" as const,
    }));

    // ── Crea run DB ──
    let runId: string | undefined;
    try {
      const run = await createRun(userId, goal, toRunProposals(initial), systemMap, fullContext, SYSTEM_MISSION);
      runId = run.id;
    } catch (e) {
      console.warn("[GlobalImprover] DB create failed, continuing without persistence:", e);
    }

    setState({
      loading: true,
      phase: "improving",
      proposals: initial,
      progress: { current: 0, total: initial.length },
      runId,
      hasResumableRun: false,
      dbSaveCount: 0,
    });

    for (let i = 0; i < initial.length; i++) {
      const p = initial[i];
      setState((s) => ({
        ...s,
        progress: { current: i, total: initial.length },
        proposals: s.proposals.map((x, idx) => (idx === i ? { ...x, status: "improving" } : x)),
      }));

      try {
        // LOVABLE-109: Contesto filtrato per blocco — riduce rumore e token
        const filteredDoctrine = filterDoctrineForBlock(fullContext, p.block, p.tabLabel);
        const filteredMap = filterSystemMapForBlock(collected, p.block, p.tabLabel);
        const filteredRef = filterReferenceForBlock(referenceMaterial, uploadedFiles, p.block, p.tabLabel);
        // Combina dottrina filtrata + riferimenti filtrati
        const blockDoctrine = filteredDoctrine + (filteredRef ? "\n\n" + filteredRef : "");

        const rawImproved = await lab.improveBlockGlobal({
          block: p.block,
          tabLabel: p.tabLabel,
          systemMap: filteredMap,
          doctrineFull: blockDoctrine,
          systemMission: SYSTEM_MISSION,
          goal: goal.trim() || undefined,
        });

        // LOVABLE-109: Parse outcome_type e architectural note dalla risposta
        const parsed = parseImproveResponse(rawImproved);
        const isSame = parsed.text.trim() === p.before.trim();
        const newStatus = (isSame || parsed.outcomeType === "no_change") ? "skipped" as const : "ready" as const;

        setState((s) => ({
          ...s,
          proposals: s.proposals.map((x, idx) =>
            idx === i ? {
              ...x,
              after: parsed.text,
              status: newStatus,
              outcomeType: parsed.outcomeType,
              architecturalNote: parsed.architecturalNote,
            } : x,
          ),
        }));

        // ── Persist incrementale (throttled, flush su ultimo/errore) ──
        if (runId) {
          const now = Date.now();
          const isLast = i === initial.length - 1;
          if (isLast || now - lastDbSave.current >= DB_THROTTLE_MS) {
            lastDbSave.current = now;
            await appendProposal(runId, i, { after: parsed.text, status: newStatus }, i + 1).catch(() => {});
            setState((s) => ({ ...s, dbSaveCount: s.dbSaveCount + 1 }));
          }
        }
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        setState((s) => ({
          ...s,
          proposals: s.proposals.map((x, idx) =>
            idx === i ? { ...x, status: "error", error: errMsg } : x,
          ),
        }));
        // Flush errore immediatamente
        if (runId) {
          await appendProposal(runId, i, { status: "error", error: errMsg }, i + 1).catch(() => {});
        }
      }
      // Piccola pausa tra blocchi per evitare di saturare il pool isolate
      // di Supabase Edge Functions (cause principale di FunctionsFetchError
      // quando si lanciano 40+ chiamate sequenziali a unified-assistant).
      if (i < initial.length - 1) {
        await new Promise((r) => setTimeout(r, 250));
      }
    }

    // ── Marca run come "review" ──
    if (runId) {
      await updateRun(runId, { status: "review", progress_current: initial.length }).catch(() => {});
    }

    setState((s) => ({
      ...s,
      loading: false,
      phase: "review",
      progress: { current: initial.length, total: initial.length },
    }));
  }, [lab, userId, goal, referenceMaterial, uploadedFiles]);

  /** Step 3: salva tutti i blocchi marcati "ready" + accettati (saveOnlyIds) sul DB. */
  const saveAccepted = useCallback(async (acceptedIds: ReadonlySet<string>) => {
    setState((s) => ({ ...s, loading: true, phase: "saving" }));
    const toSave = state.proposals.filter((p) => p.status === "ready" && acceptedIds.has(p.block.id));

    for (let i = 0; i < toSave.length; i++) {
      const p = toSave[i];
      try {
        const meta = await saveProposal(userId, p);
        await auditSaveProposal(meta, p);
        setState((s) => ({
          ...s,
          proposals: s.proposals.map((x) => (x.block.id === p.block.id ? { ...x, status: "saved" } : x)),
        }));
        // Marca come saved nel run DB
        if (state.runId) {
          await markProposalSaved(state.runId, p.block.id).catch(() => {});
        }
      } catch (e) {
        setState((s) => ({
          ...s,
          proposals: s.proposals.map((x) =>
            x.block.id === p.block.id ? { ...x, status: "error", error: e instanceof Error ? e.message : String(e) } : x,
          ),
        }));
      }
    }

    // Marca run come "done"
    if (state.runId) {
      await updateRun(state.runId, { status: "done", completed_at: new Date().toISOString() }).catch(() => {});
    }

    setState((s) => ({ ...s, loading: false, phase: "done" }));
  }, [state.proposals, state.runId, userId]);

  return { state, startImprovement, saveAccepted, reset, resumeRun, dismissResumable };
}

// Re-export for backward compatibility
export type { GlobalProposal };
