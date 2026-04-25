/**
 * harmonizeRuns.ts — DAL per "Armonizza tutto" (refactor profondo del sistema).
 *
 * Differenze rispetto a promptLabGlobalRuns:
 * - tipizza azioni multiple (UPDATE/INSERT/MOVE/DELETE)
 * - traccia inventario reale, desiderato e classificazione gap
 * - persiste lo stato di esecuzione per proposta
 */
import { supabase } from "@/integrations/supabase/client";

export type HarmonizeStatus =
  | "collecting"
  | "analyzing"
  | "review"
  | "executing"
  | "done"
  | "cancelled"
  | "failed";

export type HarmonizeActionType = "UPDATE" | "INSERT" | "MOVE" | "DELETE";
export type HarmonizeResolutionLayer = "text" | "contract" | "code_policy" | "kb_governance";
export type HarmonizeProposalStatus = "pending" | "approved" | "rejected" | "executed" | "failed";
export type HarmonizeSeverity = "low" | "medium" | "high" | "critical";
export type HarmonizeTestUrgency = "none" | "manual_smoke" | "regression_full";

export interface HarmonizeTarget {
  table:
    | "kb_entries"
    | "agents"
    | "agent_personas"
    | "operative_prompts"
    | "email_prompts"
    | "email_address_rules"
    | "commercial_playbooks"
    | "app_settings";
  id?: string;
  field?: string;
}

export interface HarmonizeEvidence {
  source: "library" | "real_db" | "uploaded_doc";
  excerpt: string;
  location?: string;
}

/** Riferimento ad un contratto/payload runtime mancante (es. EmailBrief.field_x). */
export interface MissingContract {
  contract_name: string;
  field?: string;
  why_needed: string;
}

export interface HarmonizeProposal {
  id: string;
  action: HarmonizeActionType;
  target: HarmonizeTarget;
  before?: string | null;
  after?: string | null;
  payload?: Record<string, unknown>;
  evidence: HarmonizeEvidence;
  dependencies: string[];
  impact: "low" | "medium" | "high";
  tests_required: string[];
  resolution_layer: HarmonizeResolutionLayer;
  reasoning: string;
  status: HarmonizeProposalStatus;
  block_label?: string;
  failure_reason?: string;
  // Campi del nuovo vocabolario (opzionali per retro-compat con run salvati pre-refactor).
  /** Severità del problema rilevato (separata dall'impatto operativo). */
  severity?: HarmonizeSeverity;
  /** Punteggio numerico 1-10 di rischio/portata, più espressivo del low/medium/high. */
  impact_score?: number;
  /** Quanto serve testare dopo l'esecuzione. */
  test_urgency?: HarmonizeTestUrgency;
  /** Posizione attuale (es. "kb_entries.id=xxx, category=doctrine"). */
  current_location?: string;
  /** Posizione proposta (per MOVE). */
  proposed_location?: string;
  /** Lista di contratti runtime mancanti se resolution_layer=contract. */
  missing_contracts?: MissingContract[];
  /** True se il modello considera safe applicarla in batch "approva tutte le sicure". */
  apply_recommended?: boolean;
  /** True quando il testo AI è stato corretto manualmente in review. */
  edited_by_user?: boolean;
  /** Timestamp ISO dell'ultima correzione manuale. */
  edited_at?: string;
  /** Cronologia chat tra l'operatore e Gordon (curatore) su questa proposta. */
  chat?: Array<{ role: "user" | "assistant"; content: string; ts: string }>;
  /** Nota libera dell'operatore sul perché la proposta originale era sbagliata. */
  user_correction_note?: string;
  /** Ultimo "after" rigenerato da Gordon (preview prima dell'approvazione). */
  regenerated_after?: string;
}

export interface InventorySummary {
  by_table: Record<string, number>;
  total: number;
}

export interface GapClassification {
  text_only: number;
  needs_contract: number;
  needs_code_policy: number;
  needs_kb_governance: number;
}

export interface HarmonizeRun {
  id: string;
  user_id: string;
  goal: string | null;
  scope: string;
  status: HarmonizeStatus;
  real_inventory_summary: InventorySummary | Record<string, never>;
  desired_inventory_summary: InventorySummary | Record<string, never>;
  gap_classification: GapClassification | Record<string, never>;
  proposals: HarmonizeProposal[];
  uploaded_files: Array<{ name: string; size: number }>;
  executed_count: number;
  failed_count: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  deleted_at: string | null;
}

export async function createHarmonizeRun(userId: string, goal: string, scope = "all"): Promise<HarmonizeRun> {
  const { data, error } = await supabase
    .from("harmonize_runs" as never)
    .insert({ user_id: userId, goal, scope, status: "collecting" } as never)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as HarmonizeRun;
}

export async function updateHarmonizeRun(runId: string, patch: Partial<HarmonizeRun>): Promise<void> {
  const { error } = await supabase
    .from("harmonize_runs" as never)
    .update(patch as never)
    .eq("id" as never, runId as never);
  if (error) throw error;
}

export async function appendHarmonizeProposal(runId: string, proposal: HarmonizeProposal): Promise<void> {
  const { data, error: readErr } = await supabase
    .from("harmonize_runs" as never)
    .select("proposals" as never)
    .eq("id" as never, runId as never)
    .single();
  if (readErr) throw readErr;
  const current = ((data as unknown as { proposals: HarmonizeProposal[] })?.proposals ?? []);
  const existingIndex = current.findIndex((p) => p.id === proposal.id);
  const next = existingIndex >= 0
    ? current.map((p, index) => (index === existingIndex ? proposal : p))
    : [...current, proposal];
  const { error } = await supabase
    .from("harmonize_runs" as never)
    .update({ proposals: next } as never)
    .eq("id" as never, runId as never);
  if (error) throw error;
}

export async function updateHarmonizeProposal(
  runId: string,
  proposalId: string,
  patch: Partial<HarmonizeProposal>,
): Promise<HarmonizeProposal[]> {
  const { data, error: readErr } = await supabase
    .from("harmonize_runs" as never)
    .select("proposals" as never)
    .eq("id" as never, runId as never)
    .single();
  if (readErr) throw readErr;

  const current = ((data as unknown as { proposals: HarmonizeProposal[] })?.proposals ?? []);
  let found = false;
  const next = current.map((proposal) => {
    if (proposal.id !== proposalId) return proposal;
    found = true;
    return { ...proposal, ...patch };
  });

  if (!found) throw new Error("Proposta non trovata nel run salvato");

  const { error } = await supabase
    .from("harmonize_runs" as never)
    .update({ proposals: next } as never)
    .eq("id" as never, runId as never);
  if (error) throw error;
  return next;
}

export async function setProposalStatus(
  runId: string,
  proposalId: string,
  status: HarmonizeProposalStatus,
  failureReason?: string,
): Promise<void> {
  const { data, error: readErr } = await supabase
    .from("harmonize_runs" as never)
    .select("proposals, executed_count, failed_count" as never)
    .eq("id" as never, runId as never)
    .single();
  if (readErr) throw readErr;
  const row = data as unknown as { proposals: HarmonizeProposal[]; executed_count: number; failed_count: number };
  const proposals = (row.proposals ?? []).map((p) =>
    p.id === proposalId ? { ...p, status, ...(failureReason ? { failure_reason: failureReason } : {}) } : p,
  );
  const executedDelta = status === "executed" ? 1 : 0;
  const failedDelta = status === "failed" ? 1 : 0;
  const { error } = await supabase
    .from("harmonize_runs" as never)
    .update({
      proposals,
      executed_count: (row.executed_count ?? 0) + executedDelta,
      failed_count: (row.failed_count ?? 0) + failedDelta,
    } as never)
    .eq("id" as never, runId as never);
  if (error) throw error;
}

export async function findActiveHarmonizeRun(userId: string): Promise<HarmonizeRun | null> {
  const { data, error } = await supabase
    .from("harmonize_runs" as never)
    .select("*" as never)
    .eq("user_id" as never, userId as never)
    .is("deleted_at" as never, null)
    .in("status" as never, ["collecting", "analyzing", "review", "executing"] as never)
    .order("updated_at" as never, { ascending: false } as never)
    .limit(1);
  if (error) throw error;
  const rows = data as unknown as HarmonizeRun[] | null;
  return rows && rows.length > 0 ? rows[0] : null;
}

export async function cancelHarmonizeRun(runId: string): Promise<void> {
  const { error } = await supabase
    .from("harmonize_runs" as never)
    .update({ status: "cancelled", deleted_at: new Date().toISOString() } as never)
    .eq("id" as never, runId as never);
  if (error) throw error;
}

export async function findRecentHarmonizeRuns(userId: string, limit = 5): Promise<HarmonizeRun[]> {
  const { data, error } = await supabase
    .from("harmonize_runs" as never)
    .select("*" as never)
    .eq("user_id" as never, userId as never)
    .is("deleted_at" as never, null)
    .order("updated_at" as never, { ascending: false } as never)
    .limit(limit);
  if (error) throw error;
  return (data as unknown as HarmonizeRun[]) ?? [];
}

/**
 * Appende uno o più messaggi alla chat persistente di una specifica proposta.
 * Read-modify-write atomico (stesso pattern di updateHarmonizeProposal).
 */
export async function appendProposalChat(
  runId: string,
  proposalId: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<HarmonizeProposal[]> {
  const { data, error: readErr } = await supabase
    .from("harmonize_runs" as never)
    .select("proposals" as never)
    .eq("id" as never, runId as never)
    .single();
  if (readErr) throw readErr;

  const current = ((data as unknown as { proposals: HarmonizeProposal[] })?.proposals ?? []);
  const ts = new Date().toISOString();
  const stamped = messages.map((m) => ({ ...m, ts }));
  let found = false;
  const next = current.map((proposal) => {
    if (proposal.id !== proposalId) return proposal;
    found = true;
    return { ...proposal, chat: [...(proposal.chat ?? []), ...stamped] };
  });
  if (!found) throw new Error("Proposta non trovata nel run salvato");

  const { error } = await supabase
    .from("harmonize_runs" as never)
    .update({ proposals: next } as never)
    .eq("id" as never, runId as never);
  if (error) throw error;
  return next;
}