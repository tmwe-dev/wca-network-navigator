/**
 * agentRules — System prompt + JSON schema per la micro-call AI per entità.
 *
 * Filosofia: prompt COMPATTO (~400 token), zero contesto inutile.
 * Tutto il contesto specifico (entità + candidati) va nel USER message.
 */
import { z } from "zod";

export const AGENT_SYSTEM_PROMPT = `Sei l'Armonizzatore TMWE V2.
Compito: analizzare UNA singola entità in arrivo e decidere se va aggiunta,
aggiornata, ignorata o se richiede revisione umana.

REGOLE STRINGENTI:
- UPDATE solo se confidence ≥ 0.7 E un candidato ha score ≥ 70.
- INSERT solo se NESSUN candidato ha score ≥ 70 (stessa tabella).
- SKIP se l'entità è chiaramente già presente (candidato score = 100).
- NEEDS_REVIEW se ambiguità irrisolvibile (più candidati simili score, conflitti).
- Mai inventare ID. Per UPDATE usa l'id esatto del candidato scelto.
- Estrai 0-3 fatti canonici (numeri, claim, identità).
- Apri conflict se trovi contraddizione con un fatto del recent_state.

OUTPUT: SOLO JSON valido, no markdown, no preambolo.
Schema:
{
  "decision": "INSERT" | "UPDATE" | "SKIP" | "NEEDS_REVIEW",
  "confidence": 0.0..1.0,
  "reasoning": "1-2 frasi MAX",
  "matched_candidate_id": "id|null",
  "proposal": {
    "table": "...",
    "title": "...",
    "content": "...",
    "category": "..."
  } | null,
  "extracted_facts": [{ "key": "snake_case", "value": "...", "evidence": "..." }],
  "conflict": { "topic": "...", "with_fact_key": "...", "value_seen": "..." } | null
}`;

export const ProposalSchema = z.object({
  table: z.string(),
  title: z.string(),
  content: z.string(),
  category: z.string().optional(),
}).nullable();

export const FactSchema = z.object({
  key: z.string(),
  value: z.string(),
  evidence: z.string().optional(),
});

export const ConflictSchema = z.object({
  topic: z.string(),
  with_fact_key: z.string(),
  value_seen: z.string(),
}).nullable();

export const AgentDecisionSchema = z.object({
  decision: z.enum(["INSERT", "UPDATE", "SKIP", "NEEDS_REVIEW"]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  matched_candidate_id: z.string().nullable().optional(),
  proposal: ProposalSchema.optional(),
  extracted_facts: z.array(FactSchema).default([]),
  conflict: ConflictSchema.optional(),
});

export type AgentDecision = z.infer<typeof AgentDecisionSchema>;
