/**
 * harmonizerLibraryAnalyzer — variante session-aware.
 *
 * Invoca il modello con il TMWE_INGESTION_BRIEFING e accumula in output:
 *  - HarmonizeProposal[] standard (per harmonize_runs.proposals)
 *  - extracted_facts (FactEntry[]) → vanno in session.facts_registry
 *  - new_conflicts (ConflictEntry[]) → session.conflicts_found
 *  - new_cross_refs (CrossRefEntry[]) → session.cross_references
 *  - entities_created (derivati dalle proposals INSERT) → session.entities_created
 */
import { z } from "zod";
import { callHarmonizer, parseProposalsFromText, repairTruncatedJson } from "../hooks/harmonizeAnalyzer";
import { TMWE_INGESTION_BRIEFING } from "@/v2/agent/prompts/core/tmwe-ingestion-briefing";
import type { CollectorOutput, GapCandidate } from "../hooks/harmonizeCollector";
import type { HarmonizeProposal } from "@/data/harmonizeRuns";
import type {
  HarmonizerSession,
  FactEntry,
  ConflictEntry,
  CrossRefEntry,
  EntityCreatedEntry,
} from "@/data/harmonizerSessions";
import type { TmweChunkDef } from "./tmweChunks";
import { TMWE_CHUNKS, TMWE_EXECUTION_ORDER } from "./tmweChunks";
import { buildHarmonizerKbContext } from "./harmonizerKbInjector";

import { createLogger } from "@/lib/log";
const log = createLogger("harmonizerLibraryAnalyzer");

const FactSchema = z.object({
  value: z.string(),
  evidence: z.string().optional(),
});

const ConflictSchema = z.object({
  id: z.string().optional(),
  topic: z.string(),
  source_a: z.object({ ref: z.string(), value: z.string() }),
  source_b: z.object({ ref: z.string(), value: z.string() }),
  status: z.enum(["pending", "resolved", "ignored"]).default("pending"),
  notes: z.string().optional(),
});

const CrossRefSchema = z.object({
  from: z.object({ table: z.string(), id: z.string(), label: z.string() }),
  to: z.object({ table: z.string(), id: z.string(), label: z.string() }),
  relation: z.string(),
});

const ExtendedResponseSchema = z.object({
  extracted_facts: z.record(z.string(), FactSchema).optional(),
  new_conflicts: z.array(ConflictSchema).optional(),
  new_cross_refs: z.array(CrossRefSchema).optional(),
});

export interface LibraryAnalyzerOutput {
  proposals: HarmonizeProposal[];
  extractedFacts: FactEntry[];
  newConflicts: ConflictEntry[];
  newCrossRefs: CrossRefEntry[];
  entitiesCreated: EntityCreatedEntry[];
}

function uid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function buildLibraryUserPrompt(
  collector: CollectorOutput,
  chunk: GapCandidate[],
  chunkDef: TmweChunkDef,
  session: HarmonizerSession,
  goal: string,
  opts?: { gapsBudgetChars?: number },
): string {
  const realSummary = `Tabelle filtrate: ${Object.entries(collector.realSummary.by_table).map(([k, v]) => `${k}=${v}`).join(", ")}. Totale: ${collector.realSummary.total}`;
  const desiredSummary = `Da chunk: ${Object.entries(collector.desiredSummary.by_table).map(([k, v]) => `${k}=${v}`).join(", ")}. Totale: ${collector.desiredSummary.total}`;

  const factsTop = Object.entries(session.facts_registry).slice(0, 10).map(([k, f]) =>
    `- ${k} = "${f.value}"`,
  ).join("\n") || "(nessuno)";

  const conflictsList = session.conflicts_found.slice(0, 5).map((c) =>
    `- [${c.status}] ${c.topic}`,
  ).join("\n") || "(nessuno)";

  const entitiesList = session.entities_created
    .filter((e) => chunkDef.targetTables.includes(e.table))
    .slice(0, 15)
    .map((e) => `- ${e.table}: "${e.title}"`)
    .join("\n") || "(nessuna)";

  const preloadedDups = chunkDef.preloadedDuplicates.map((d) => `- ${d.title} (${d.reason})`).join("\n") || "(nessuno)";
  const preloadedConfs = chunkDef.preloadedConflicts.map((c) => `- ${c.topic}: ${c.notes ?? ""}`).join("\n") || "(nessuno)";

  // Roadmap globale: dove siamo nella sequenza, cosa è già stato processato,
  // cosa resta. Il modello capisce che è un lavoro multi-step e non deve
  // "anticipare" chunk futuri o duplicare lavoro già fatto.
  const totalChunks = TMWE_CHUNKS.length;
  const positionInOrder = TMWE_EXECUTION_ORDER.indexOf(chunkDef.index);
  const stepNumber = positionInOrder >= 0 ? positionInOrder + 1 : chunkDef.index + 1;
  const processedChunkIndexes = positionInOrder > 0
    ? TMWE_EXECUTION_ORDER.slice(0, positionInOrder)
    : [];
  const remainingChunkIndexes = positionInOrder >= 0
    ? TMWE_EXECUTION_ORDER.slice(positionInOrder + 1)
    : [];
  const fmtChunkRef = (i: number) => {
    const c = TMWE_CHUNKS[i];
    return c ? `#${c.index} ${c.name} [${c.targetTables.join(",")}]` : `#${i}`;
  };
  const processedList = processedChunkIndexes.length > 0
    ? processedChunkIndexes.map(fmtChunkRef).join("\n  - ")
    : "(nessuno — questo è il primo chunk)";
  const remainingList = remainingChunkIndexes.length > 0
    ? remainingChunkIndexes.map(fmtChunkRef).join("\n  - ")
    : "(nessuno — questo è l'ultimo chunk)";

  // Adaptive budget for gap section: avoid token explosion on large chunks.
  const gapsBudget = opts?.gapsBudgetChars ?? 12000;
  const allocPerGap = chunk.length > 0 ? Math.floor(gapsBudget / chunk.length) : gapsBudget;
  const contentMaxChars = Math.max(150, allocPerGap - 250);
  const gapsText = chunk.map((g, i) => {
    const matchedInfo = g.matched
      ? `MATCH ESISTENTE (id=${g.matched.id ?? "n/d"}, tabella=${g.matched.table}, titolo="${g.matched.title}")`
      : "MATCH ESISTENTE: nessuno (candidato a INSERT)";
    return `--- GAP #${i + 1} ---
BUCKET: ${g.bucket}
RAGIONE: ${g.reason}

DESIDERATO:
- titolo: ${g.desired.title}
- tabella target: ${g.desired.table}
- categoria: ${g.desired.category ?? "n/d"}
- contenuto:
${g.desired.content.slice(0, contentMaxChars)}

${matchedInfo}`;
  }).join("\n\n");

  return `=== CONTESTO RUN ===
goal: ${goal || "(non specificato)"}
chunk corrente: #${chunkDef.index} — ${chunkDef.name}
posizione globale: STEP ${stepNumber} di ${totalChunks} (ordine ottimale ingestion)
target_tables: ${chunkDef.targetTables.join(", ")}

=== ROADMAP GLOBALE INGESTION ===
Già processati (NON riproporre lavoro già coperto qui):
  - ${processedList}

Ancora da processare (NON anticipare contenuti di questi chunk: arriveranno):
  - ${remainingList}

REGOLA SCOPE: in questo step PUOI proporre SOLO modifiche alle tabelle
[${chunkDef.targetTables.join(", ")}]. Se un gap richiederebbe
toccare una tabella diversa, segnala come cross_reference o readonly_note,
non come proposta diretta — sarà coperta nel chunk dedicato.

=== CONTRACT GUIDANCE PER QUESTO CHUNK ===
${chunkDef.contractGuidance}

=== STATO SESSIONE PRECEDENTE ===
facts_registry (top 10):
${factsTop}

conflicts_found (top 5):
${conflictsList}

entities_created (target tables, top 15):
${entitiesList}

=== CONFLITTI/DUPLICATI PRE-CARICATI PER QUESTO CHUNK ===
Duplicati noti (skip silenzioso):
${preloadedDups}

Conflitti pre-caricati (referenze):
${preloadedConfs}

=== INVENTARIO REALE (filtrato a target tables) ===
${realSummary}

=== INVENTARIO DESIDERATO (da chunk) ===
${desiredSummary}

=== GAP DA ANALIZZARE (${chunk.length}) ===
${gapsText}

ISTRUZIONI FINALI:
- Una azione per gap (puoi spezzare con dependencies se necessario).
- Estrai facts, conflicts, cross-refs come da sezione Z del briefing.
- Rispondi SOLO JSON puro: {"proposals":[...], "extracted_facts":{...}, "new_conflicts":[...], "new_cross_refs":[...]}`;
}

/** Estrae il blocco JSON dal raw (fence o oggetto bilanciato). */
function extractJsonObject(raw: string): string | null {
  if (!raw) return null;
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) return fence[1].trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) return raw.slice(start, end + 1);
  return null;
}

function parseExtended(raw: string, chunkIndex: number): {
  facts: FactEntry[];
  conflicts: ConflictEntry[];
  crossRefs: CrossRefEntry[];
} {
  const empty = { facts: [], conflicts: [], crossRefs: [] };
  const json = extractJsonObject(raw);
  if (!json) return empty;
  let parsedRaw: unknown;
  try {
    parsedRaw = JSON.parse(json);
  } catch {
    // Fallback: JSON troncato per token explosion.
    try {
      parsedRaw = JSON.parse(repairTruncatedJson(json));
      log.warn("[libraryAnalyzer] extended JSON repaired after truncation", { chunkIndex });
    } catch {
      return empty;
    }
  }
  const result = ExtendedResponseSchema.safeParse(parsedRaw);
  if (!result.success) return empty;

  const facts: FactEntry[] = Object.entries(result.data.extracted_facts ?? {}).map(([key, v]) => ({
    key,
    value: v.value,
    evidence: v.evidence,
    source_chunk: chunkIndex,
  }));

  const conflicts: ConflictEntry[] = (result.data.new_conflicts ?? []).map((c) => ({
    id: c.id ?? uid(),
    topic: c.topic,
    source_a: c.source_a,
    source_b: c.source_b,
    status: c.status,
    detected_in_chunk: chunkIndex,
    notes: c.notes,
  }));

  const crossRefs: CrossRefEntry[] = (result.data.new_cross_refs ?? []).map((r) => ({
    from: r.from,
    to: r.to,
    relation: r.relation,
    detected_in_chunk: chunkIndex,
  }));

  return { facts, conflicts, crossRefs };
}

/** Esegue l'analyzer per UN chunk. Restituisce proposte + delta sessione. */
export async function runLibraryChunkAnalyzer(input: {
  collector: CollectorOutput;
  chunkDef: TmweChunkDef;
  session: HarmonizerSession;
  goal: string;
}): Promise<LibraryAnalyzerOutput> {
  const { collector, chunkDef, session, goal } = input;

  if (collector.diagnostics?.placeholder_detected) {
    throw new Error(
      `Chunk #${chunkDef.index} contiene ancora testo placeholder, non la libreria reale. Carica il file corretto e rilancia.`,
    );
  }

  if ((collector.diagnostics?.source_line_count ?? 0) === 0) {
    throw new Error(
      `Chunk #${chunkDef.index} è vuoto nel file caricato. Il documento non rispetta la mappa a 7 chunk o è incompleto.`,
    );
  }

  if ((collector.diagnostics?.desired_parsed_count ?? collector.desired.length) === 0) {
    throw new Error(
      `Chunk #${chunkDef.index} non contiene blocchi parseabili. Verifica heading/struttura del documento sorgente.`,
    );
  }

  const actionable = [...collector.gaps.text_only, ...collector.gaps.needs_kb_governance];
  if (actionable.length === 0) {
    return { proposals: [], extractedFacts: [], newConflicts: [], newCrossRefs: [], entitiesCreated: [] };
  }

  // Cap adattivo: i chunk che toccano kb_entries producono proposte molto
  // verbose (proposed_content lungo + reasoning), saturano facilmente il
  // budget output → cap=10. Per gli altri (agents/personas/prompts) cap=20.
  // I gap in eccesso vengono ripresi al retry/resume del chunk.
  const maxGaps = chunkDef.targetTables.includes("kb_entries") ? 10 : 20;
  const cap = actionable.slice(0, maxGaps);
  if (actionable.length > maxGaps) {
    console.info(
      `[libraryAnalyzer] chunk #${chunkDef.index} cap=${maxGaps}, ${actionable.length - maxGaps} gap rinviati a retry`,
    );
  }

  // Inietta i .md vincolanti della KB Harmonizer per le tabelle target del
  // chunk. Senza questa iniezione il modello "vede" solo i nomi dei file
  // citati nel briefing → inventa colonne, categorie, enum.
  let kbContext = "";
  try {
    kbContext = await buildHarmonizerKbContext(chunkDef.targetTables);
  } catch (e) {
    log.warn("[libraryAnalyzer] KB injection failed, proceeding without", e);
  }

  // Build prompt at multiple compression levels for retry strategy.
  const buildAtLevel = (level: 1 | 2 | 3) => {
    const budget = level === 3 ? 6000 : 12000;
    const userPrompt = buildLibraryUserPrompt(
      collector, cap, chunkDef, session, goal, { gapsBudgetChars: budget },
    );
    const systemPrompt = level === 1 && kbContext
      ? `${TMWE_INGESTION_BRIEFING}${kbContext}`
      : TMWE_INGESTION_BRIEFING;
    return { userPrompt, systemPrompt };
  };

  // 3-level retry on empty response (token explosion symptom):
  //   L1 = full prompt + KB context
  //   L2 = full prompt without KB context
  //   L3 = compressed prompt (50% gap budget) without KB context
  async function callWithRetry(): Promise<string> {
    for (const level of [1, 2, 3] as const) {
      const { userPrompt, systemPrompt } = buildAtLevel(level);
      let r = "";
      try {
        r = await callHarmonizer(userPrompt, systemPrompt);
      } catch (e) {
        log.error(`[libraryAnalyzer] call failed (level=${level})`, e);
        if (level === 3) throw e;
        continue;
      }
      if (r && r.trim().length > 0) return r;
      log.warn(`[libraryAnalyzer] retry level=${level} reason=empty chunk=#${chunkDef.index}`);
    }
    return "";
  }

  const raw = await callWithRetry();

  // Empty response anche dopo retry → ERRORE esplicito (la pipeline si ferma).
  if (!raw || raw.trim().length === 0) {
    throw new Error(
      `Modello AI ha restituito risposta vuota per chunk #${chunkDef.index} (${chunkDef.name}). ` +
      `Possibile token explosion o rate limit. Riprova il chunk o riduci il sorgente.`,
    );
  }

  const proposals = parseProposalsFromText(raw, cap);
  const extended = parseExtended(raw, chunkDef.index);

  // SCOPE GUARD: scarta proposte fuori dalle target tables del chunk.
  // Le proposte fuori scope vanno gestite nel chunk dedicato per evitare
  // doppie modifiche e collisioni di sessione. Loggiamo cosa abbiamo scartato.
  const inScope: typeof proposals = [];
  const outOfScope: typeof proposals = [];
  for (const p of proposals) {
    if (chunkDef.targetTables.includes(p.target?.table)) {
      inScope.push(p);
    } else {
      outOfScope.push(p);
    }
  }
  if (outOfScope.length > 0) {
    log.warn(
      `[libraryAnalyzer] chunk #${chunkDef.index} ${outOfScope.length} proposte fuori scope scartate`,
      {
        scope: chunkDef.targetTables,
        outOfScope: outOfScope.map((p) => ({ table: p.target?.table, label: p.block_label })),
      },
    );
  }

  // Parser ha fallito su tutto → ERRORE (invece di marciare a 0 proposte).
  if (inScope.length === 0 && extended.facts.length === 0 && extended.conflicts.length === 0) {
    const outScopeNote = outOfScope.length > 0
      ? ` (${outOfScope.length} proposte erano fuori scope: ${outOfScope.map((p) => p.target?.table).join(", ")})`
      : "";
    throw new Error(
      `Parser non è riuscito a estrarre nulla in scope per chunk #${chunkDef.index}.${outScopeNote} ` +
      `Preview: "${raw.slice(0, 200).replace(/\n/g, " ")}..."`,
    );
  }

  // Deriva entities_created dalle proposals INSERT.
  const entitiesCreated: EntityCreatedEntry[] = inScope
    .filter((p) => p.action === "INSERT" && p.target?.table)
    .map((p) => ({
      table: p.target.table,
      id: p.target.id,
      title: p.block_label ?? "(senza titolo)",
      created_in_chunk: chunkDef.index,
      proposal_id: p.id,
    }));

  return {
    proposals: inScope,
    extractedFacts: extended.facts,
    newConflicts: extended.conflicts,
    newCrossRefs: extended.crossRefs,
    entitiesCreated,
  };
}
