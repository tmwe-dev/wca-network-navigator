/**
 * harmonizeAnalyzer — invoca il Lab Agent con il prompt HARMONIZER
 * e parser delle proposte tipizzate.
 *
 * Strategia:
 *  - chunking per categoria/tabella (max ~6 gap per call, evita context overflow)
 *  - per ogni chunk produce N proposte HarmonizeProposal
 *  - i bucket needs_contract / needs_code_policy NON vengono mandati al modello:
 *    diventano proposte read-only auto-generate (resolution_layer dichiarato).
 */
import { invokeEdge } from "@/lib/api/invokeEdge";
import { HARMONIZER_BRIEFING } from "@/v2/agent/prompts/core/harmonizer-briefing";
import type { HarmonizeProposal, HarmonizeActionType, HarmonizeResolutionLayer } from "@/data/harmonizeRuns";
import type { CollectorOutput, GapCandidate } from "./harmonizeCollector";

const CHUNK_SIZE = 6;

interface UnifiedAssistantResponse {
  content?: string;
  structured?: Record<string, unknown>;
}

/** Genera UUID con fallback sicuro per ambienti senza crypto.randomUUID. */
function uid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/** Costruisce prompt utente con il chunk di gap actionable. */
function buildUserPrompt(realSummary: string, desiredSummary: string, chunk: GapCandidate[]): string {
  const gapsText = chunk.map((g, i) => {
    const matchedInfo = g.matched
      ? `MATCH ESISTENTE (id=${g.matched.id ?? "n/d"}, tabella=${g.matched.table}, titolo="${g.matched.title}")\nCONTENUTO ATTUALE: ${g.matched.content.slice(0, 600)}`
      : "MATCH ESISTENTE: nessuno (candidato a INSERT)";
    return `--- GAP #${i + 1} ---
BUCKET: ${g.bucket}
RAGIONE: ${g.reason}

DESIDERATO:
- titolo: ${g.desired.title}
- tabella target: ${g.desired.table}
- categoria: ${g.desired.category ?? "n/d"}
- capitolo: ${g.desired.chapter ?? "n/d"}
- priorità: ${g.desired.priority ?? "n/d"}
- figura: ${g.desired.figure ?? "n/d"}
- contenuto desiderato:
${g.desired.content.slice(0, 1200)}

${matchedInfo}
--- FINE GAP #${i + 1} ---`;
  }).join("\n\n");

  return `=== INVENTARIO REALE (sintesi) ===
${realSummary}

=== INVENTARIO DESIDERATO (sintesi) ===
${desiredSummary}

=== GAP DA ANALIZZARE (${chunk.length}) ===
${gapsText}

ISTRUZIONI:
- Analizza ogni gap e proponi una sola azione (UPDATE/INSERT/MOVE/DELETE) per gap.
- Se un gap richiede 2 azioni separate (es. MOVE + UPDATE), spezzalo in 2 proposte con dependencies.
- Mai proporre DELETE su agents o agent_personas.
- Mai proporre azioni su tabelle non in elenco.
- Compila tutti i campi richiesti dal tool schema.
- Rispondi SOLO via tool call 'propose_harmonize_actions'.`;
}

/** Invoca il modello in modalità conversational con il briefing Harmonizer. */
async function callHarmonizer(userPrompt: string): Promise<string> {
  const result = await invokeEdge<UnifiedAssistantResponse>("unified-assistant", {
    body: {
      scope: "kb-supervisor",
      mode: "conversational",
      messages: [{ role: "user", content: userPrompt }],
      context: {
        currentPage: "prompt-lab",
        page: "prompt-lab",
        operatorBriefing: HARMONIZER_BRIEFING,
        extra_context: { mode: "harmonize" },
      },
    },
    context: "harmonizeAnalyzer",
  });
  return (result.content ?? "").trim();
}

/**
 * Parser tollerante: l'edge function unified-assistant restituisce testo.
 * Cerchiamo blocchi JSON `{"proposals":[...]}` nel testo. Se non trovati,
 * tentiamo regex per oggetti `proposals` array.
 */
function parseProposalsFromText(raw: string, chunk: GapCandidate[]): HarmonizeProposal[] {
  // Tenta JSON puro
  const jsonMatch = raw.match(/\{[\s\S]*"proposals"[\s\S]*\}/);
  if (!jsonMatch) return [];

  let parsed: { proposals?: unknown[] } | null = null;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return [];
  }
  if (!parsed?.proposals || !Array.isArray(parsed.proposals)) return [];

  return parsed.proposals
    .map((p, idx): HarmonizeProposal | null => {
      const obj = p as Record<string, unknown>;
      const action = String(obj.action ?? "") as HarmonizeActionType;
      if (!["UPDATE", "INSERT", "MOVE", "DELETE"].includes(action)) return null;
      const targetTable = String(obj.target_table ?? "");
      if (!targetTable) return null;

      const matched = chunk[idx]?.matched;
      const desired = chunk[idx]?.desired;

      return {
        id: uid(),
        action,
        target: {
          table: targetTable as HarmonizeProposal["target"]["table"],
          id: (obj.target_id as string | undefined) ?? matched?.id ?? undefined,
          field: (obj.target_field as string | undefined) ?? undefined,
        },
        before: (obj.before as string | undefined) ?? matched?.content ?? null,
        after: (obj.after as string | undefined) ?? desired?.content ?? null,
        payload: (obj.payload as Record<string, unknown> | undefined) ?? undefined,
        evidence: {
          source: (obj.evidence_source as "library" | "real_db" | "uploaded_doc") ?? "library",
          excerpt: String(obj.evidence_excerpt ?? desired?.content?.slice(0, 200) ?? ""),
          location: (obj.evidence_location as string | undefined) ?? undefined,
        },
        dependencies: Array.isArray(obj.dependencies) ? (obj.dependencies as string[]) : [],
        impact: (["low", "medium", "high"].includes(String(obj.impact)) ? obj.impact : "medium") as HarmonizeProposal["impact"],
        tests_required: Array.isArray(obj.tests_required) ? (obj.tests_required as string[]) : [],
        resolution_layer: (["text", "contract", "code_policy", "kb_governance"].includes(String(obj.resolution_layer))
          ? obj.resolution_layer
          : "text") as HarmonizeResolutionLayer,
        reasoning: String(obj.reasoning ?? ""),
        block_label: String(obj.block_label ?? desired?.title ?? "Proposta"),
        status: "pending",
      };
    })
    .filter((x): x is HarmonizeProposal => x !== null);
}

/** Auto-genera proposte READ-ONLY per i bucket non azionabili. */
function buildReadOnlyProposals(
  bucket: "needs_contract" | "needs_code_policy",
  candidates: GapCandidate[],
): HarmonizeProposal[] {
  const layer: HarmonizeResolutionLayer = bucket === "needs_contract" ? "contract" : "code_policy";
  return candidates.map((g): HarmonizeProposal => ({
    id: uid(),
    action: "INSERT",
    target: { table: "kb_entries" }, // placeholder, NON verrà eseguita
    before: null,
    after: null,
    payload: { read_only: true, bucket },
    evidence: { source: "library", excerpt: g.desired.content.slice(0, 300) },
    dependencies: [],
    impact: "high",
    tests_required: [],
    resolution_layer: layer,
    reasoning: `${g.reason} Richiede intervento sviluppatore (${layer}). NON eseguibile dall'Harmonizer.`,
    block_label: `[follow-up sviluppatore] ${g.desired.title}`,
    status: "pending",
  }));
}

/** Pipeline analyzer completa. Callback per persistenza incrementale. */
export async function runHarmonizeAnalyzer(
  collector: CollectorOutput,
  onProposal: (p: HarmonizeProposal) => Promise<void>,
  onProgress?: (current: number, total: number) => void,
): Promise<HarmonizeProposal[]> {
  const all: HarmonizeProposal[] = [];

  const realSummary = `Tabelle: ${Object.entries(collector.realSummary.by_table).map(([k, v]) => `${k}=${v}`).join(", ")}. Totale: ${collector.realSummary.total}`;
  const desiredSummary = `Tabelle: ${Object.entries(collector.desiredSummary.by_table).map(([k, v]) => `${k}=${v}`).join(", ")}. Totale: ${collector.desiredSummary.total}`;

  const actionable = [...collector.gaps.text_only, ...collector.gaps.needs_kb_governance];
  const chunks: GapCandidate[][] = [];
  for (let i = 0; i < actionable.length; i += CHUNK_SIZE) {
    chunks.push(actionable.slice(i, i + CHUNK_SIZE));
  }

  let done = 0;
  const total = chunks.length + 2; // +2 per i due bucket read-only finali

  for (const chunk of chunks) {
    try {
      const userPrompt = buildUserPrompt(realSummary, desiredSummary, chunk);
      const raw = await callHarmonizer(userPrompt);
      const parsed = parseProposalsFromText(raw, chunk);
      for (const p of parsed) {
        all.push(p);
        await onProposal(p);
      }
    } catch (e) {
      // non bloccare: continua coi prossimi chunk
      console.error("[harmonizeAnalyzer] chunk failed", e);
    }
    done++;
    onProgress?.(done, total);
  }

  // Bucket read-only
  for (const p of buildReadOnlyProposals("needs_contract", collector.gaps.needs_contract)) {
    all.push(p); await onProposal(p);
  }
  done++; onProgress?.(done, total);

  for (const p of buildReadOnlyProposals("needs_code_policy", collector.gaps.needs_code_policy)) {
    all.push(p); await onProposal(p);
  }
  done++; onProgress?.(done, total);

  return all;
}