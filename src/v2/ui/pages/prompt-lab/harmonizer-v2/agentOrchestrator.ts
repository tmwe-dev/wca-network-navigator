/**
 * agentOrchestrator — Pipeline V2 entity-by-entity per "Armonizza tutto".
 *
 * Stadi:
 *   0. parseEntities (client-side)
 *   1. buildCompactIndex (DB metadati)
 *   2. loop entità: match → retrieve → reason+retry → commit
 *   3. selfReview finale (warnings)
 */
import { parseEntities, type EntityToParse } from "./entityParser";
import { buildCompactIndex, indexToBootstrapEntities, type CompactIndex } from "./compactIndex";
import { findCandidates } from "./entityMatcher";
import { createRetrieverCache, retrieveContents } from "./entityRetriever";
import { reasonAboutEntity, type ReasonerResult } from "./agentReasoner";
import {
  createHarmonizerSession,
  appendFacts,
  appendEntities,
  completeHarmonizerSession,
  type FactEntry,
  type EntityCreatedEntry,
} from "@/data/harmonizerSessions";
import {
  createHarmonizeRun,
  appendHarmonizeProposal,
  updateHarmonizeRun,
  type HarmonizeProposal,
  type HarmonizeActionType,
} from "@/data/harmonizeRuns";

export type EntityStatus = "pending" | "processing" | "done" | "skipped" | "needs_review" | "error";

export interface EntityProgress {
  id: string;
  title: string;
  inferredTable: string;
  status: EntityStatus;
  decision?: "INSERT" | "UPDATE" | "SKIP" | "NEEDS_REVIEW";
  confidence?: number;
  reasoning?: string;
  attemptsUsed?: number;
  errorMsg?: string;
}

export interface OrchestratorStats {
  total: number;
  inserts: number;
  updates: number;
  skips: number;
  needsReview: number;
  errors: number;
  factsExtracted: number;
  insertRate: number;
}

export interface OrchestratorWarning {
  level: "info" | "warning" | "error";
  message: string;
}

export interface OrchestratorOutput {
  sessionId: string;
  runId: string;
  entities: EntityProgress[];
  stats: OrchestratorStats;
  warnings: OrchestratorWarning[];
}

export interface OrchestratorCallbacks {
  onPhaseChange?: (phase: "parsing" | "indexing" | "processing" | "reviewing" | "done") => void;
  onIndexBuilt?: (index: CompactIndex) => void;
  onEntityProgress?: (entity: EntityProgress, idx: number, total: number) => void;
  shouldAbort?: () => boolean;
}

function decisionToActionType(d: ReasonerResult["decision"]): HarmonizeActionType | null {
  if (d.decision === "INSERT") return "INSERT";
  if (d.decision === "UPDATE") return "UPDATE";
  return null;
}

function selfReview(stats: OrchestratorStats, entities: EntityProgress[]): OrchestratorWarning[] {
  const warnings: OrchestratorWarning[] = [];
  if (stats.insertRate > 0.8 && stats.total >= 5) {
    warnings.push({
      level: "warning",
      message: `Insert rate ${(stats.insertRate * 100).toFixed(0)}% > 80%: il modello potrebbe non riconoscere entità esistenti.`,
    });
  }
  if (stats.needsReview > 0) {
    warnings.push({
      level: "info",
      message: `${stats.needsReview} entità marcate per revisione umana.`,
    });
  }
  if (stats.errors > 0) {
    warnings.push({
      level: "error",
      message: `${stats.errors} entità in errore (tutte le strategie di retry fallite).`,
    });
  }
  // Duplicate inserts (stesso titolo proposto INSERT più volte).
  const insertTitles = new Map<string, number>();
  for (const e of entities) {
    if (e.decision === "INSERT") {
      insertTitles.set(e.title.toLowerCase(), (insertTitles.get(e.title.toLowerCase()) ?? 0) + 1);
    }
  }
  for (const [title, count] of insertTitles) {
    if (count > 1) {
      warnings.push({
        level: "warning",
        message: `INSERT duplicato per "${title}" (${count} volte)`,
      });
    }
  }
  return warnings;
}

export async function runAgenticHarmonizer(input: {
  userId: string;
  sourceText: string;
  sourceFileName: string;
  goal: string;
  callbacks?: OrchestratorCallbacks;
}): Promise<OrchestratorOutput> {
  const { userId, sourceText, sourceFileName, goal, callbacks } = input;
  const cb = callbacks ?? {};

  // 0. Parse
  cb.onPhaseChange?.("parsing");
  const entities = await parseEntities(sourceText);
  if (entities.length === 0) {
    throw new Error("Nessuna entità trovata nel documento (verifica heading markdown).");
  }

  // 1. Compact Index
  cb.onPhaseChange?.("indexing");
  const index = await buildCompactIndex(userId);
  cb.onIndexBuilt?.(index);

  // Crea run + sessione (agentic_mode = true via campo; per ora usa colonna esistente).
  const run = await createHarmonizeRun(userId, goal, "library_agentic_v2");
  const session = await createHarmonizerSession({
    userId,
    sourceFile: sourceFileName,
    sourceKind: "library",
    totalChunks: entities.length,
    harmonizeRunId: run.id,
    bootstrapEntities: indexToBootstrapEntities(index).slice(0, 200) as EntityCreatedEntry[],
  });
  await updateHarmonizeRun(run.id, { status: "analyzing" }).catch(() => {});

  // 2. Loop processing
  cb.onPhaseChange?.("processing");
  const cache = createRetrieverCache(userId);
  const progress: EntityProgress[] = entities.map((e) => ({
    id: e.id,
    title: e.title,
    inferredTable: e.inferredTable,
    status: "pending",
  }));

  const recentDecisions: { entityTitle: string; decision: string }[] = [];
  const recentFacts: FactEntry[] = [];
  let factsExtracted = 0;

  // Process N entità in parallelo per batch. Aumenta throughput ~5x.
  // I "recentDecisions"/"recentFacts" sono hint best-effort: in batch concorrenti
  // alcune entità non li vedranno aggiornati, ma è accettabile.
  const CONCURRENCY = 5;

  const processOne = async (i: number): Promise<void> => {
    if (cb.shouldAbort?.()) return;
    const entity = entities[i];
    progress[i].status = "processing";
    cb.onEntityProgress?.(progress[i], i, entities.length);

    try {
      const candidates = findCandidates(entity, index, 3);
      const candidateContents = candidates.length > 0
        ? await retrieveContents(cache, candidates.map((c) => ({ id: c.entry.id, table: c.entry.table })))
        : [];

      const result = await reasonAboutEntity({
        entity,
        candidates,
        candidateContents,
        recentDecisions: recentDecisions.slice(-5),
        recentFacts: recentFacts.slice(-5),
      });

      const d = result.decision;
      progress[i].decision = d.decision;
      progress[i].confidence = d.confidence;
      progress[i].reasoning = d.reasoning;
      progress[i].attemptsUsed = result.attemptsUsed;

      if (d.decision === "SKIP") {
        progress[i].status = "skipped";
      } else if (d.decision === "NEEDS_REVIEW" || result.needsHumanReview) {
        progress[i].status = "needs_review";
      } else {
        progress[i].status = "done";
      }

      // Persist proposal se INSERT/UPDATE.
      const action = decisionToActionType(d);
      if (action && d.proposal) {
        const proposal: HarmonizeProposal = {
          id: `${session.id}-${entity.id}`,
          action,
          target: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            table: (d.proposal.table || entity.inferredTable) as any,
            id: action === "UPDATE" ? d.matched_candidate_id ?? undefined : undefined,
          },
          before: action === "UPDATE" ? candidateContents.find((c) => c.id === d.matched_candidate_id)?.content ?? null : null,
          after: d.proposal.content,
          evidence: {
            source: "library",
            excerpt: entity.content.slice(0, 200),
            location: `lines ${entity.sourceLineStart}-${entity.sourceLineEnd}`,
          },
          dependencies: [],
          impact: d.confidence > 0.8 ? "low" : "medium",
          tests_required: [],
          resolution_layer: "text",
          reasoning: d.reasoning,
          status: "pending",
          block_label: d.proposal.title,
          apply_recommended: d.confidence > 0.85 && action === "UPDATE",
        };
        await appendHarmonizeProposal(run.id, proposal).catch((e) => {
          console.warn("[orchestrator] persist proposal failed", e);
        });
      }

      // Estrai facts.
      if (d.extracted_facts.length > 0) {
        const facts: FactEntry[] = d.extracted_facts.map((f) => ({
          key: f.key,
          value: f.value,
          source_chunk: i,
          evidence: f.evidence,
        }));
        recentFacts.push(...facts);
        factsExtracted += facts.length;
        await appendFacts(session.id, facts).catch(() => {});
      }

      // Append to session.entities_created se INSERT.
      if (d.decision === "INSERT" && d.proposal) {
        await appendEntities(session.id, [{
          table: d.proposal.table,
          title: d.proposal.title,
          created_in_chunk: i,
        }]).catch(() => {});
      }

      recentDecisions.push({ entityTitle: entity.title, decision: d.decision });
    } catch (err) {
      progress[i].status = "error";
      progress[i].errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[orchestrator] entity #${i} fatal`, err);
    }

    cb.onEntityProgress?.(progress[i], i, entities.length);
  };

  for (let i = 0; i < entities.length; i += CONCURRENCY) {
    if (cb.shouldAbort?.()) break;
    const batchIndices: number[] = [];
    for (let j = i; j < Math.min(i + CONCURRENCY, entities.length); j++) {
      batchIndices.push(j);
    }
    await Promise.all(batchIndices.map((idx) => processOne(idx)));
  }

  // 3. Self-review
  cb.onPhaseChange?.("reviewing");
  const stats: OrchestratorStats = {
    total: progress.length,
    inserts: progress.filter((p) => p.decision === "INSERT").length,
    updates: progress.filter((p) => p.decision === "UPDATE").length,
    skips: progress.filter((p) => p.status === "skipped").length,
    needsReview: progress.filter((p) => p.status === "needs_review").length,
    errors: progress.filter((p) => p.status === "error").length,
    factsExtracted,
    insertRate: 0,
  };
  const decided = stats.inserts + stats.updates;
  stats.insertRate = decided > 0 ? stats.inserts / decided : 0;

  const warnings = selfReview(stats, progress);

  await completeHarmonizerSession(session.id).catch(() => {});
  await updateHarmonizeRun(run.id, { status: "review" }).catch(() => {});

  cb.onPhaseChange?.("done");
  return {
    sessionId: session.id,
    runId: run.id,
    entities: progress,
    stats,
    warnings,
  };
}
