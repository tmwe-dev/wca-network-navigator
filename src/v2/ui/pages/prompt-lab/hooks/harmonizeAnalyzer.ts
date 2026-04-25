/**
 * harmonizeAnalyzer — invoca il modello con il prompt HARMONIZER strutturato
 * e valida l'output JSON con Zod.
 *
 * Strategia:
 *  - chunking per categoria/tabella (max ~6 gap per call, evita context overflow)
 *  - inietta goal utente, lingua, modalità nel user message
 *  - parser robusto: Zod + log esplicito chunk falliti (no più "[]" silenzioso)
 *  - bucket needs_contract / needs_code_policy → proposte READ-ONLY auto-generate
 */
import { z } from "zod";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { HARMONIZER_BRIEFING } from "@/v2/agent/prompts/core/harmonizer-briefing";
import type {
  HarmonizeProposal,
  HarmonizeActionType,
  HarmonizeResolutionLayer,
  HarmonizeSeverity,
  HarmonizeTestUrgency,
  MissingContract,
} from "@/data/harmonizeRuns";
import type { CollectorOutput, GapCandidate } from "./harmonizeCollector";

const CHUNK_SIZE = 6;

interface UnifiedAssistantResponse {
  content?: string;
  structured?: Record<string, unknown>;
}

export interface AnalyzerContext {
  goal: string;
  operatorId: string;
  operatorRole?: string;
  language?: string;
  mode?: "first_run" | "delta" | "review_reopen";
}

const ProposalSchema = z.object({
  action_type: z.enum(["UPDATE", "INSERT", "MOVE", "DELETE"]),
  target_table: z.enum([
    "kb_entries", "agents", "agent_personas", "operative_prompts",
    "email_prompts", "email_address_rules", "commercial_playbooks", "app_settings",
  ]),
  target_id: z.string().nullable().optional(),
  target_field: z.string().nullable().optional(),
  block_name: z.string().optional(),
  current_location: z.string().optional(),
  proposed_location: z.string().optional(),
  current_issue: z.string().optional(),
  proposed_content: z.string().optional(),
  before: z.string().nullable().optional(),
  after: z.string().nullable().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  evidence_source: z.enum(["library", "real_db", "uploaded_doc"]).default("library"),
  evidence_excerpt: z.string().default(""),
  evidence_location: z.string().nullable().optional(),
  dependencies: z.array(z.string()).default([]),
  impact_score: z.number().min(1).max(10).optional(),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  test_urgency: z.enum(["none", "manual_smoke", "regression_full"]).optional(),
  tests_required: z.array(z.string()).default([]),
  resolution_layer: z.enum(["text", "kb_governance", "contract", "code_policy"]).default("text"),
  missing_contracts: z
    .array(z.object({
      contract_name: z.string(),
      field: z.string().optional(),
      why_needed: z.string(),
    }))
    .optional(),
  apply_recommended: z.boolean().optional(),
  reasoning: z.string().default(""),
});

const ResponseSchema = z.object({
  proposals: z.array(ProposalSchema),
});

/** Genera UUID con fallback sicuro per ambienti senza crypto.randomUUID. */
function uid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/** Mappa severity/impact_score → impact legacy low/medium/high. */
function impactFromScore(score?: number, severity?: HarmonizeSeverity): "low" | "medium" | "high" {
  if (severity === "critical" || severity === "high") return "high";
  if (severity === "low") return "low";
  if (typeof score === "number") {
    if (score >= 7) return "high";
    if (score <= 3) return "low";
  }
  return "medium";
}

/** Costruisce prompt utente con il chunk di gap actionable. */
function buildUserPrompt(
  realSummary: string,
  desiredSummary: string,
  chunk: GapCandidate[],
  ctx: AnalyzerContext,
): string {
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

  return `=== CONTESTO RUN ===
goal: ${ctx.goal || "(non specificato — applica gerarchia di verità standard)"}
operatore: ${ctx.operatorId}${ctx.operatorRole ? ` (ruolo=${ctx.operatorRole})` : ""}
lingua: ${ctx.language ?? "it"}
modalità: ${ctx.mode ?? "first_run"}

=== INVENTARIO REALE (sintesi) ===
${realSummary}

=== INVENTARIO DESIDERATO (sintesi) ===
${desiredSummary}

=== GAP DA ANALIZZARE (${chunk.length}) ===
${gapsText}

ISTRUZIONI:
- Analizza ogni gap. Una azione per gap; spezza in più proposte con dependencies se servono passi distinti.
- Compila i campi del nuovo vocabolario (action_type, severity, impact_score, test_urgency).
- Se l'azione richiede un campo non in nessun contratto runtime → resolution_layer=contract + missing_contracts[].
- Se richiede una guard nel codice → resolution_layer=code_policy + payload.code_policy_needed.
- Rispondi SOLO con JSON puro {"proposals":[...]}. Nessun testo libero, niente fence, niente markdown.`;
}

/** Invoca il modello in modalità conversational con il briefing Harmonizer. */
export async function callHarmonizer(userPrompt: string, briefing: string = HARMONIZER_BRIEFING): Promise<string> {
  const result = await invokeEdge<UnifiedAssistantResponse>("unified-assistant", {
    body: {
      scope: "kb-supervisor",
      mode: "conversational",
      messages: [{ role: "user", content: userPrompt }],
      context: {
        currentPage: "prompt-lab",
        page: "prompt-lab",
        operatorBriefing: briefing,
        extra_context: { mode: "harmonize" },
      },
    },
    context: "harmonizeAnalyzer",
  });
  return (result.content ?? "").trim();
}

/**
 * Estrae il blocco JSON dal raw del modello (può contenere fence o testo intorno).
 */
function extractJsonObject(raw: string): string | null {
  if (!raw) return null;
  // 1. fence ```json ... ```
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) return fence[1].trim();
  // 2. primo { fino all'ultimo } bilanciato (greedy)
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) return raw.slice(start, end + 1);
  return null;
}

/**
 * Auto-repair di JSON troncato (causa tipica: cap max_tokens raggiunto).
 * Bilancia stringhe aperte e parentesi {}/[] in coda e rimuove la virgola
 * pendente. NON corregge sintassi interna malformata: solo troncamento.
 */
export function repairTruncatedJson(s: string): string {
  let out = s;
  // 1. Stringa aperta? Conta apici non escapati.
  let inString = false;
  let escape = false;
  for (let i = 0; i < out.length; i++) {
    const ch = out[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') inString = !inString;
  }
  if (inString) out += '"';
  // 2. Conta {} e [] non in stringa.
  let openObj = 0;
  let openArr = 0;
  inString = false;
  escape = false;
  for (const ch of out) {
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") openObj++;
    else if (ch === "}") openObj--;
    else if (ch === "[") openArr++;
    else if (ch === "]") openArr--;
  }
  // 3. Rimuovi virgola pendente prima delle chiusure aggiunte.
  out = out.replace(/,\s*$/, "");
  while (openArr-- > 0) out += "]";
  while (openObj-- > 0) out += "}";
  return out;
}

/**
 * Parser robusto con Zod: log visibile su fallimento invece di [] silenzioso.
 * Validazione INDIVIDUALE per proposta: se 18/20 sono valide e 2 hanno
 * enum sbagliato, recupera le 18 invece di scartare tutto.
 */
export function parseProposalsFromText(raw: string, chunk: GapCandidate[]): HarmonizeProposal[] {
  const jsonStr = extractJsonObject(raw);
  if (!jsonStr) {
    console.warn("[harmonizeAnalyzer] no JSON found in response", { rawPreview: raw.slice(0, 200) });
    return [];
  }
  let parsedRaw: unknown;
  try {
    parsedRaw = JSON.parse(jsonStr);
  } catch (e1) {
    // Tentativo di recupero: JSON troncato per token explosion.
    try {
      parsedRaw = JSON.parse(repairTruncatedJson(jsonStr));
      console.warn("[harmonizeAnalyzer] JSON repaired after truncation", {
        originalEnd: jsonStr.slice(-80),
      });
    } catch (e2) {
      console.warn("[harmonizeAnalyzer] JSON.parse failed even after repair", {
        err: String(e1),
        repairErr: String(e2),
        preview: jsonStr.slice(0, 200),
      });
      return [];
    }
  }

  // Validazione INDIVIDUALE per proposta (resilienza all-or-nothing Zod).
  const rawObj = (parsedRaw && typeof parsedRaw === "object")
    ? (parsedRaw as Record<string, unknown>)
    : {};
  const rawProposals = Array.isArray(rawObj.proposals) ? rawObj.proposals : [];
  const validProposals: z.infer<typeof ProposalSchema>[] = [];
  let skipped = 0;
  for (let i = 0; i < rawProposals.length; i++) {
    const r = ProposalSchema.safeParse(rawProposals[i]);
    if (r.success) {
      validProposals.push(r.data);
    } else {
      skipped++;
      console.warn(`[harmonizeAnalyzer] proposal #${i} skipped`, {
        firstIssue: r.error.issues[0],
        proposalKeys: typeof rawProposals[i] === "object" && rawProposals[i] !== null
          ? Object.keys(rawProposals[i] as object)
          : typeof rawProposals[i],
      });
    }
  }
  if (skipped > 0) {
    console.warn(
      `[harmonizeAnalyzer] ${skipped}/${rawProposals.length} proposte scartate per validazione, ${validProposals.length} valide recuperate`,
    );
  }

  return validProposals.map((p, idx): HarmonizeProposal => {
    const matched = chunk[idx]?.matched;
    const desired = chunk[idx]?.desired;
    const action = p.action_type as HarmonizeActionType;
    const layer = p.resolution_layer as HarmonizeResolutionLayer;
    const severity = p.severity as HarmonizeSeverity | undefined;
    const testUrgency = p.test_urgency as HarmonizeTestUrgency | undefined;
    const impact = impactFromScore(p.impact_score, severity);

    return {
      id: uid(),
      action,
      target: {
        table: p.target_table as HarmonizeProposal["target"]["table"],
        id: p.target_id ?? matched?.id ?? undefined,
        field: p.target_field ?? undefined,
      },
      before: p.before ?? matched?.content ?? null,
      after: p.after ?? p.proposed_content ?? desired?.content ?? null,
      payload: p.payload ?? undefined,
      evidence: {
        source: p.evidence_source,
        excerpt: p.evidence_excerpt || desired?.content?.slice(0, 200) || "",
        location: p.evidence_location ?? undefined,
      },
      dependencies: p.dependencies,
      impact,
      tests_required: p.tests_required,
      resolution_layer: layer,
      reasoning: p.reasoning,
      block_label: p.block_name ?? desired?.title ?? "Proposta",
      status: "pending",
      // Vocabolario nuovo (passa-attraverso)
      severity,
      impact_score: p.impact_score,
      test_urgency: testUrgency,
      current_location: p.current_location,
      proposed_location: p.proposed_location,
      missing_contracts: p.missing_contracts as MissingContract[] | undefined,
      apply_recommended: p.apply_recommended,
    };
  });
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
    severity: "high",
    impact_score: 8,
    test_urgency: "manual_smoke",
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
  ctx?: AnalyzerContext,
): Promise<HarmonizeProposal[]> {
  const all: HarmonizeProposal[] = [];
  const context: AnalyzerContext = ctx ?? {
    goal: "",
    operatorId: "anonymous",
    language: "it",
    mode: "first_run",
  };

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
      const userPrompt = buildUserPrompt(realSummary, desiredSummary, chunk, context);
      const raw = await callHarmonizer(userPrompt);
      const parsed = parseProposalsFromText(raw, chunk);
      if (parsed.length === 0) {
        console.warn("[harmonizeAnalyzer] chunk produced 0 proposals", {
          gapTitles: chunk.map((g) => g.desired.title),
        });
      }
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