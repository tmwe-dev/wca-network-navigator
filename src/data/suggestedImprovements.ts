/**
 * @deprecated Table 'suggested_improvements' does not exist in current schema (types.ts).
 * The table exists in Supabase migrations (20260423_suggested_improvements.sql) but
 * TypeScript types have not been generated. Functions will log warnings and return early.
 *
 * suggestedImprovements.ts — DAL per il ciclo di apprendimento continuo.
 *
 * L'AI propone suggerimenti → utente conferma → admin approva → Architect consuma.
 *
 * Tipi:
 * - user_preference: auto-approvato, personale (es. "preferisco email corte")
 * - kb_rule: richiede approvazione admin, diventa voce KB
 * - prompt_adjustment: richiede approvazione admin, modifica un prompt esistente
 */
import { supabase } from "@/integrations/supabase/client";

import { createLogger } from "@/lib/log";
const log = createLogger("suggestedImprovements");

const TABLE_WARNING = 'Table "suggested_improvements" is not included in supabase/types.ts. Table exists in DB but type definitions are missing.';

export type SuggestionType = "kb_rule" | "prompt_adjustment" | "user_preference";
export type SuggestionPriority = "low" | "medium" | "high" | "critical";
export type SuggestionStatus = "pending" | "approved" | "rejected" | "applied";
export type SuggestionSource =
  | "chat"
  | "email_edit"
  | "feedback"
  | "manual_correction"
  | "voice_call"
  | "classification_override";

export interface SuggestedImprovement {
  id: string;
  created_by: string;
  created_at: string;
  source_context: SuggestionSource;
  suggestion_type: SuggestionType;
  title: string;
  content: string;
  reasoning: string | null;
  target_block_id: string | null;
  target_category: string | null;
  priority: SuggestionPriority;
  status: SuggestionStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  applied_at: string | null;
  applied_in_run_id: string | null;
  /** Populated only from the pending_suggestions view */
  creator_name?: string;
}

// ─── Create ───

export interface CreateSuggestionInput {
  source_context: SuggestionSource;
  suggestion_type: SuggestionType;
  title: string;
  content: string;
  reasoning?: string;
  target_block_id?: string;
  target_category?: string;
  priority?: SuggestionPriority;
}

/**
 * Crea un suggerimento. Se è user_preference, lo auto-approva.
 *
 * @deprecated Table 'suggested_improvements' not in schema. This function will not execute.
 */
export async function createSuggestion(
  userId: string,
  input: CreateSuggestionInput,
): Promise<SuggestedImprovement> {
  log.warn(TABLE_WARNING);
  throw new Error('createSuggestion: Table "suggested_improvements" not available in schema');
}

// ─── Read ───

/**
 * Suggerimenti dell'utente corrente (qualsiasi stato).
 * @deprecated Table 'suggested_improvements' not in schema. This function will not execute.
 */
export async function listMySuggestions(userId: string): Promise<SuggestedImprovement[]> {
  log.warn(TABLE_WARNING);
  return [];
}

/**
 * Suggerimenti pending per admin review (kb_rule + prompt_adjustment).
 * @deprecated Table 'suggested_improvements' not in schema. This function will not execute.
 */
export async function listPendingForAdmin(): Promise<SuggestedImprovement[]> {
  log.warn(TABLE_WARNING);
  return [];
}

/**
 * Suggerimenti approvati non ancora consumati dall'Architect.
 * @deprecated Table 'suggested_improvements' not in schema. This function will not execute.
 */
export async function listApprovedForArchitect(): Promise<SuggestedImprovement[]> {
  log.warn(TABLE_WARNING);
  return [];
}

/**
 * Preferenze utente approvate (per iniettare in learned_patterns).
 * @deprecated Table 'suggested_improvements' not in schema. This function will not execute.
 */
export async function listUserPreferences(userId: string): Promise<SuggestedImprovement[]> {
  log.warn(TABLE_WARNING);
  return [];
}

// ─── Admin actions ───

/**
 * Approva un suggerimento (solo admin).
 * @deprecated Table 'suggested_improvements' not in schema. This function will not execute.
 */
export async function approveSuggestion(
  id: string,
  adminId: string,
  note?: string,
): Promise<void> {
  log.warn(TABLE_WARNING);
  throw new Error('approveSuggestion: Table "suggested_improvements" not available in schema');
}

/**
 * Rifiuta un suggerimento (solo admin).
 * @deprecated Table 'suggested_improvements' not in schema. This function will not execute.
 */
export async function rejectSuggestion(
  id: string,
  adminId: string,
  note?: string,
): Promise<void> {
  log.warn(TABLE_WARNING);
  throw new Error('rejectSuggestion: Table "suggested_improvements" not available in schema');
}

/**
 * Modifica il contenuto prima di approvare (solo admin).
 * @deprecated Table 'suggested_improvements' not in schema. This function will not execute.
 */
export async function editAndApprove(
  id: string,
  adminId: string,
  newContent: string,
  note?: string,
): Promise<void> {
  log.warn(TABLE_WARNING);
  throw new Error('editAndApprove: Table "suggested_improvements" not available in schema');
}

// ─── Architect consumption ───

/**
 * Marca suggerimenti come "applied" dopo che l'Architect li ha consumati.
 * Chiamata al termine del salvataggio del run Migliora tutto.
 * @deprecated Table 'suggested_improvements' not in schema. This function will not execute.
 */
export async function markSuggestionsApplied(
  ids: string[],
  runId: string,
): Promise<void> {
  if (ids.length === 0) return;
  log.warn(TABLE_WARNING);
}

// ─── Learned patterns assembly ───

/**
 * Assembla le user_preferences + kb_rules approvate/applied in una stringa
 * "learned_patterns" da iniettare nel campo style.learned_patterns di EmailBrief.
 *
 * Formato: elenco compatto di regole, ciascuna con titolo e contenuto abbreviato.
 * Chiamato dal frontend quando costruisce il payload per generate-email/improve-email.
 * @deprecated Table 'suggested_improvements' not in schema. This function will not execute.
 */
export async function buildLearnedPatterns(userId: string): Promise<string> {
  log.warn(TABLE_WARNING);
  return "";
}

/**
 * Conta suggerimenti per stato (per badge UI).
 * @deprecated Table 'suggested_improvements' not in schema. This function will not execute.
 */
export async function countByStatus(): Promise<Record<SuggestionStatus, number>> {
  log.warn(TABLE_WARNING);
  return {
    pending: 0,
    approved: 0,
    rejected: 0,
    applied: 0,
  };
}
