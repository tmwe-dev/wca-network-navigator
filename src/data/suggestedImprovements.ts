/**
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
 */
export async function createSuggestion(
  userId: string,
  input: CreateSuggestionInput,
): Promise<SuggestedImprovement> {
  const isAutoApprove = input.suggestion_type === "user_preference";

  const { data, error } = await (supabase as any)
    .from("suggested_improvements")
    .insert({
      created_by: userId,
      source_context: input.source_context,
      suggestion_type: input.suggestion_type,
      title: input.title,
      content: input.content,
      reasoning: input.reasoning ?? null,
      target_block_id: input.target_block_id ?? null,
      target_category: input.target_category ?? null,
      priority: input.priority ?? "medium",
      // user_preference → auto-approved
      status: isAutoApprove ? "approved" : "pending",
      reviewed_by: isAutoApprove ? userId : null,
      reviewed_at: isAutoApprove ? new Date().toISOString() : null,
      review_note: isAutoApprove ? "Auto-approvato (preferenza utente)" : null,
    })
    .select()
    .single();

  if (error) throw new Error(`createSuggestion: ${error.message}`);
  return data as SuggestedImprovement;
}

// ─── Read ───

/** Suggerimenti dell'utente corrente (qualsiasi stato). */
export async function listMySuggestions(userId: string): Promise<SuggestedImprovement[]> {
  const { data, error } = await (supabase as any)
    .from("suggested_improvements")
    .select("*")
    .eq("created_by", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(`listMySuggestions: ${error.message}`);
  return (data ?? []) as SuggestedImprovement[];
}

/** Suggerimenti pending per admin review (kb_rule + prompt_adjustment). */
export async function listPendingForAdmin(): Promise<SuggestedImprovement[]> {
  const { data, error } = await (supabase as any)
    .from("suggested_improvements")
    .select("*")
    .eq("status", "pending")
    .in("suggestion_type", ["kb_rule", "prompt_adjustment"])
    .order("created_at", { ascending: false });

  if (error) throw new Error(`listPendingForAdmin: ${error.message}`);
  return (data ?? []) as SuggestedImprovement[];
}

/** Suggerimenti approvati non ancora consumati dall'Architect. */
export async function listApprovedForArchitect(): Promise<SuggestedImprovement[]> {
  const { data, error } = await (supabase as any)
    .from("suggested_improvements")
    .select("*")
    .eq("status", "approved")
    .order("created_at", { ascending: true });

  if (error) throw new Error(`listApprovedForArchitect: ${error.message}`);
  return (data ?? []) as SuggestedImprovement[];
}

/** Preferenze utente approvate (per iniettare in learned_patterns). */
export async function listUserPreferences(userId: string): Promise<SuggestedImprovement[]> {
  const { data, error } = await (supabase as any)
    .from("suggested_improvements")
    .select("*")
    .eq("created_by", userId)
    .eq("suggestion_type", "user_preference")
    .in("status", ["approved", "applied"])
    .order("created_at", { ascending: true });

  if (error) throw new Error(`listUserPreferences: ${error.message}`);
  return (data ?? []) as SuggestedImprovement[];
}

// ─── Admin actions ───

/** Approva un suggerimento (solo admin). */
export async function approveSuggestion(
  id: string,
  adminId: string,
  note?: string,
): Promise<void> {
  const { error } = await (supabase as any)
    .from("suggested_improvements")
    .update({
      status: "approved",
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
      review_note: note ?? null,
    })
    .eq("id", id);

  if (error) throw new Error(`approveSuggestion: ${error.message}`);
}

/** Rifiuta un suggerimento (solo admin). */
export async function rejectSuggestion(
  id: string,
  adminId: string,
  note?: string,
): Promise<void> {
  const { error } = await (supabase as any)
    .from("suggested_improvements")
    .update({
      status: "rejected",
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
      review_note: note ?? "Rifiutato dall'admin",
    })
    .eq("id", id);

  if (error) throw new Error(`rejectSuggestion: ${error.message}`);
}

/** Modifica il contenuto prima di approvare (solo admin). */
export async function editAndApprove(
  id: string,
  adminId: string,
  newContent: string,
  note?: string,
): Promise<void> {
  const { error } = await (supabase as any)
    .from("suggested_improvements")
    .update({
      content: newContent,
      status: "approved",
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
      review_note: note ?? "Modificato e approvato dall'admin",
    })
    .eq("id", id);

  if (error) throw new Error(`editAndApprove: ${error.message}`);
}

// ─── Architect consumption ───

/**
 * Marca suggerimenti come "applied" dopo che l'Architect li ha consumati.
 * Chiamata al termine del salvataggio del run Migliora tutto.
 */
export async function markSuggestionsApplied(
  ids: string[],
  runId: string,
): Promise<void> {
  if (ids.length === 0) return;

  const { error } = await (supabase as any)
    .from("suggested_improvements")
    .update({
      status: "applied",
      applied_at: new Date().toISOString(),
      applied_in_run_id: runId,
    })
    .in("id", ids);

  if (error) throw new Error(`markSuggestionsApplied: ${error.message}`);
}

// ─── Learned patterns assembly ───

/**
 * Assembla le user_preferences + kb_rules approvate/applied in una stringa
 * "learned_patterns" da iniettare nel campo style.learned_patterns di EmailBrief.
 *
 * Formato: elenco compatto di regole, ciascuna con titolo e contenuto abbreviato.
 * Chiamato dal frontend quando costruisce il payload per generate-email/improve-email.
 */
export async function buildLearnedPatterns(userId: string): Promise<string> {
  try {
    const { data, error } = await (supabase as any)
      .from("suggested_improvements")
      .select("title, content, suggestion_type, priority")
      .or(`and(created_by.eq.${userId},suggestion_type.eq.user_preference),suggestion_type.in.(kb_rule,prompt_adjustment)`)
      .in("status", ["approved", "applied"])
      .order("priority", { ascending: false })
      .limit(30);

    if (error || !data || (data as unknown[]).length === 0) return "";

    const rows = data as Array<{ title: string; content: string; suggestion_type: string; priority: string }>;
    return rows
      .map((r) => `[${r.suggestion_type}|${r.priority}] ${r.title}: ${r.content.slice(0, 300)}${r.content.length > 300 ? "…" : ""}`)
      .join("\n");
  } catch {
    return "";
  }
}

/**
 * Conta suggerimenti per stato (per badge UI).
 */
export async function countByStatus(): Promise<Record<SuggestionStatus, number>> {
  const counts: Record<SuggestionStatus, number> = {
    pending: 0,
    approved: 0,
    rejected: 0,
    applied: 0,
  };

  const { data, error } = await (supabase as any)
    .from("suggested_improvements")
    .select("status");

  if (error || !data) return counts;

  for (const row of data as Array<{ status: SuggestionStatus }>) {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
  }
  return counts;
}
