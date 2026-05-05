import type { OutcomeType } from "../useProposalProcessing";
import type { ParsedImproveResult } from "./types";

const VALID_OUTCOME_TYPES = new Set<OutcomeType>([
  "text_fix",
  "kb_fix",
  "contract_needed",
  "code_policy_needed",
  "runtime_mapping_fix",
  "no_change",
]);

/**
 * Parsa OUTCOME_TYPE e ARCHITECTURAL_NOTE dalla risposta AI.
 *
 * Fix A2 (apr 2026): cerca i marker su TUTTA la stringa con regex multilinea
 * invece che solo nelle prime 5 righe.
 */
const OUTCOME_LINE_RE = /^[ \t]*OUTCOME_TYPE:[ \t]*([A-Za-z_]+)[ \t]*$/m;
const ARCH_NOTE_LINE_RE = /^[ \t]*ARCHITECTURAL_NOTE:[ \t]*(.+)$/m;

export function parseImproveResponse(raw: string): ParsedImproveResult {
  let outcomeType: OutcomeType = "text_fix";
  let architecturalNote: string | undefined;

  const outcomeMatch = raw.match(OUTCOME_LINE_RE);
  if (outcomeMatch) {
    const candidate = outcomeMatch[1].trim().toLowerCase() as OutcomeType;
    if (VALID_OUTCOME_TYPES.has(candidate)) outcomeType = candidate;
  }

  const archMatch = raw.match(ARCH_NOTE_LINE_RE);
  if (archMatch) architecturalNote = archMatch[1].trim();

  const text = raw
    .replace(OUTCOME_LINE_RE, "")
    .replace(ARCH_NOTE_LINE_RE, "")
    .trim();

  return { text: text || raw.trim(), outcomeType, architecturalNote };
}