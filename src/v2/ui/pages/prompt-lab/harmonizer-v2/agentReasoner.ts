/**
 * agentReasoner — costruisce il user prompt per la micro-call e gestisce retry.
 *
 * Validazione:
 *  - Zod schema (AgentDecisionSchema)
 *  - Coherence check: UPDATE senza match → invalid; INSERT con match esatto same-table → invalid;
 *    confidence < 0.3 con decisione non SKIP → invalid.
 *
 * Retry adattivo (3 tentativi):
 *   tentativo 1: prompt completo
 *   tentativo 2: "simplify" — rimuove candidati cross-table, taglia content
 *   tentativo 3: "explicit_match" — forza considerazione candidato top score
 *
 * Dopo 3 fallimenti: SKIP graceful con needsHumanReview = true.
 */
import { invokeAgenticMicroCall } from "@/v2/io/edge/agenticMicro";
import {
  AGENT_SYSTEM_PROMPT,
  AgentDecisionSchema,
  type AgentDecision,
} from "./agentRules";
import type { EntityToParse } from "./entityParser";
import type { MatchCandidate } from "./entityMatcher";
import type { FullEntryContent } from "./entityRetriever";
import type { FactEntry } from "@/data/harmonizerSessions";


import { createLogger } from "@/lib/log";
const log = createLogger("agentReasoner");
export type RetryStrategy = "full" | "simplify" | "explicit_match";

export interface ReasonerInput {
  entity: EntityToParse;
  candidates: MatchCandidate[];
  candidateContents: FullEntryContent[];
  recentDecisions: { entityTitle: string; decision: string }[];
  recentFacts: FactEntry[];
}

export interface ReasonerResult {
  decision: AgentDecision;
  attemptsUsed: number;
  finalStrategy: RetryStrategy;
  needsHumanReview: boolean;
  rawError?: string;
}

const SAFETY_FALLBACK: AgentDecision = {
  decision: "NEEDS_REVIEW",
  confidence: 0,
  reasoning: "Modello AI ha fallito tutte le strategie di retry. Revisione umana richiesta.",
  matched_candidate_id: null,
  proposal: null,
  extracted_facts: [],
  conflict: null,
};

function buildUserPrompt(input: ReasonerInput, strategy: RetryStrategy): string {
  let candidates = input.candidates;
  let contentMaxChars = 1500;

  if (strategy === "simplify") {
    candidates = candidates.filter((c) => c.entry.table === input.entity.inferredTable);
    contentMaxChars = 800;
  } else if (strategy === "explicit_match" && candidates.length > 0) {
    candidates = [candidates[0]];
  }

  const candById = new Map(input.candidateContents.map((c) => [c.id, c]));

  const candidatesBlock = candidates.length === 0
    ? "(nessun candidato di matching trovato)"
    : candidates
        .map((c, i) => {
          const full = candById.get(c.entry.id);
          const fullContent = full ? full.content : "(contenuto non disponibile)";
          return `--- Candidato #${i + 1} (score ${c.score}) ---\nid: ${c.entry.id}\ntable: ${c.entry.table}\ntitle: ${c.entry.title}\nreason: ${c.reason}\ncontent:\n${fullContent.slice(0, 1200)}`;
        })
        .join("\n\n");

  const recentDecBlock = input.recentDecisions.length === 0
    ? "(prima entità della sessione)"
    : input.recentDecisions.map((d) => `- ${d.entityTitle} → ${d.decision}`).join("\n");

  const recentFactsBlock = input.recentFacts.length === 0
    ? "(nessun fatto registrato)"
    : input.recentFacts.map((f) => `- ${f.key}: ${f.value}`).join("\n");

  const entityContent = input.entity.content.slice(0, contentMaxChars);

  const strategyHint = strategy === "explicit_match"
    ? "\n[NOTA: tentativo 3 — VALUTA CON ATTENZIONE il candidato fornito. Se è davvero la stessa cosa → UPDATE, altrimenti INSERT.]"
    : "";

  return `## ENTITÀ DA ANALIZZARE
title: ${input.entity.title}
inferred_table: ${input.entity.inferredTable}
category: ${input.entity.category}
content:
${entityContent}

## CANDIDATI DAL DB (top ${candidates.length})
${candidatesBlock}

## RECENT DECISIONS (ultime 5)
${recentDecBlock}

## FATTI CANONICI RECENTI (top 5)
${recentFactsBlock}
${strategyHint}

Ritorna SOLO il JSON con la tua decisione.`;
}

function validateCoherence(d: AgentDecision, input: ReasonerInput): string | null {
  // UPDATE senza candidato matchato → invalid
  if (d.decision === "UPDATE" && !d.matched_candidate_id) {
    return "UPDATE senza matched_candidate_id";
  }
  if (d.decision === "UPDATE" && d.matched_candidate_id) {
    const found = input.candidates.find((c) => c.entry.id === d.matched_candidate_id);
    if (!found) return "matched_candidate_id non corrisponde a nessun candidato";
  }
  // INSERT con un candidato score 100 same-table → invalid
  if (d.decision === "INSERT") {
    const exact = input.candidates.find(
      (c) => c.score >= 100 && c.entry.table === input.entity.inferredTable,
    );
    if (exact) return "INSERT proposto ma esiste candidato esatto stessa tabella";
  }
  // confidence troppo bassa con decisione non-SKIP → invalid
  if (d.confidence < 0.3 && d.decision !== "SKIP" && d.decision !== "NEEDS_REVIEW") {
    return "Confidence < 0.3 ma decisione non è SKIP/NEEDS_REVIEW";
  }
  return null;
}

function tryParseJson(raw: string): unknown {
  // Prova diretto.
  try { return JSON.parse(raw); } catch { /* fallthrough */ }
  // Prova a estrarre il primo {…} bilanciato.
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try { return JSON.parse(raw.slice(firstBrace, lastBrace + 1)); } catch { /* fallthrough */ }
  }
  // Prova a rimuovere fence markdown.
  const stripped = raw.replace(/```(?:json)?\s*/g, "").replace(/```/g, "").trim();
  try { return JSON.parse(stripped); } catch { /* fallthrough */ }
  return null;
}

const STRATEGIES: RetryStrategy[] = ["full", "simplify", "explicit_match"];

export async function reasonAboutEntity(input: ReasonerInput): Promise<ReasonerResult> {
  let lastError: string | undefined;

  for (let i = 0; i < STRATEGIES.length; i++) {
    const strategy = STRATEGIES[i];
    const userPrompt = buildUserPrompt(input, strategy);

    try {
      const rawResponse = await invokeAgenticMicroCall({
        system: AGENT_SYSTEM_PROMPT,
        user: userPrompt,
        max_tokens: 1024,
        temperature: 0.1,
      });

      const parsed = tryParseJson(rawResponse);
      if (!parsed) {
        lastError = `Tentativo ${i + 1}/${STRATEGIES.length} (${strategy}): JSON invalido`;
        continue;
      }

      const validated = AgentDecisionSchema.safeParse(parsed);
      if (!validated.success) {
        lastError = `Tentativo ${i + 1}/${STRATEGIES.length} (${strategy}): Zod fail — ${validated.error.issues[0]?.message ?? "unknown"}`;
        continue;
      }

      const coherenceErr = validateCoherence(validated.data, input);
      if (coherenceErr) {
        lastError = `Tentativo ${i + 1}/${STRATEGIES.length} (${strategy}): coherence — ${coherenceErr}`;
        continue;
      }

      return {
        decision: validated.data,
        attemptsUsed: i + 1,
        finalStrategy: strategy,
        needsHumanReview: validated.data.decision === "NEEDS_REVIEW",
      };
    } catch (err) {
      lastError = `Tentativo ${i + 1}/${STRATEGIES.length} (${strategy}): exception — ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  log.warn("[agentReasoner] all strategies failed", { entity: input.entity.title, lastError });
  return {
    decision: SAFETY_FALLBACK,
    attemptsUsed: STRATEGIES.length,
    finalStrategy: "explicit_match",
    needsHumanReview: true,
    rawError: lastError,
  };
}
