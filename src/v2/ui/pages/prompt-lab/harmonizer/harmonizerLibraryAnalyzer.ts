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
import { callHarmonizer, parseProposalsFromText } from "../hooks/harmonizeAnalyzer";
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
import { buildHarmonizerKbContext } from "./harmonizerKbInjector";

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
): string {
  const realSummary = `Tabelle filtrate: ${Object.entries(collector.realSummary.by_table).map(([k, v]) => `${k}=${v}`).join(", ")}. Totale: ${collector.realSummary.total}`;
  const desiredSummary = `Da chunk: ${Object.entries(collector.desiredSummary.by_table).map(([k, v]) => `${k}=${v}`).join(", ")}. Totale: ${collector.desiredSummary.total}`;

  const factsTop = Object.entries(session.facts_registry).slice(0, 15).map(([k, f]) =>
    `- ${k} = "${f.value}"`,
  ).join("\n") || "(nessuno)";

  const conflictsList = session.conflicts_found.slice(0, 10).map((c) =>
    `- [${c.status}] ${c.topic}`,
  ).join("\n") || "(nessuno)";

  const entitiesList = session.entities_created
    .filter((e) => chunkDef.targetTables.includes(e.table))
    .slice(0, 30)
    .map((e) => `- ${e.table}: "${e.title}"`)
    .join("\n") || "(nessuna)";

  const preloadedDups = chunkDef.preloadedDuplicates.map((d) => `- ${d.title} (${d.reason})`).join("\n") || "(nessuno)";
  const preloadedConfs = chunkDef.preloadedConflicts.map((c) => `- ${c.topic}: ${c.notes ?? ""}`).join("\n") || "(nessuno)";

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
${g.desired.content.slice(0, 500)}

${matchedInfo}`;
  }).join("\n\n");

  return `=== CONTESTO RUN ===
goal: ${goal || "(non specificato)"}
chunk: #${chunkDef.index} — ${chunkDef.name}
target_tables: ${chunkDef.targetTables.join(", ")}

=== CONTRACT GUIDANCE PER QUESTO CHUNK ===
${chunkDef.contractGuidance}

=== STATO SESSIONE PRECEDENTE ===
facts_registry (top 30):
${factsTop}

conflicts_found (top 20):
${conflictsList}

entities_created (target tables, top 50):
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
  try { parsedRaw = JSON.parse(json); } catch { return empty; }
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

  const actionable = [...collector.gaps.text_only, ...collector.gaps.needs_kb_governance];
  if (actionable.length === 0) {
    return { proposals: [], extractedFacts: [], newConflicts: [], newCrossRefs: [], entitiesCreated: [] };
  }

  // Cap a 20 gap per chunk: il modello a 60 con KB+briefing+stato saturava
  // la context window e restituiva output vuoto. Per chunk densi (Doctrine,
  // Email) si fa retry/resume per processare i restanti.
  const cap = actionable.slice(0, 20);
  const userPrompt = buildLibraryUserPrompt(collector, cap, chunkDef, session, goal);

  // Inietta i .md vincolanti della KB Harmonizer per le tabelle target del
  // chunk. Senza questa iniezione il modello "vede" solo i nomi dei file
  // citati nel briefing → inventa colonne, categorie, enum.
  let kbContext = "";
  try {
    kbContext = await buildHarmonizerKbContext(chunkDef.targetTables);
  } catch (e) {
    console.warn("[libraryAnalyzer] KB injection failed, proceeding without", e);
  }
  const systemPrompt = kbContext
    ? `${TMWE_INGESTION_BRIEFING}${kbContext}`
    : TMWE_INGESTION_BRIEFING;

  // Helper: chiama il modello e ritenta UNA volta con prompt compatto se
  // la prima call torna vuota (sintomo classico di token explosion).
  async function callWithRetry(): Promise<string> {
    let r = "";
    try {
      r = await callHarmonizer(userPrompt, systemPrompt);
    } catch (e) {
      console.error("[libraryAnalyzer] call failed", e);
      throw e;
    }
    if (r && r.trim().length > 0) return r;

    console.warn("[libraryAnalyzer] empty response, retrying without KB injection");
    try {
      r = await callHarmonizer(userPrompt, TMWE_INGESTION_BRIEFING);
    } catch (e) {
      console.error("[libraryAnalyzer] retry failed", e);
      throw e;
    }
    return r;
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

  // Parser ha fallito su tutto → ERRORE (invece di marciare a 0 proposte).
  if (proposals.length === 0 && extended.facts.length === 0 && extended.conflicts.length === 0) {
    throw new Error(
      `Parser non è riuscito a estrarre nulla dalla risposta del modello per chunk #${chunkDef.index}. ` +
      `Preview: "${raw.slice(0, 200).replace(/\n/g, " ")}..."`,
    );
  }

  // Deriva entities_created dalle proposals INSERT.
  const entitiesCreated: EntityCreatedEntry[] = proposals
    .filter((p) => p.action === "INSERT" && p.target?.table)
    .map((p) => ({
      table: p.target.table,
      id: p.target.id,
      title: p.block_label ?? "(senza titolo)",
      created_in_chunk: chunkDef.index,
      proposal_id: p.id,
    }));

  return {
    proposals,
    extractedFacts: extended.facts,
    newConflicts: extended.conflicts,
    newCrossRefs: extended.crossRefs,
    entitiesCreated,
  };
}
