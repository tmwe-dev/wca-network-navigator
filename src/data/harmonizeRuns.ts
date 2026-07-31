/**
 * harmonizeRuns.ts — DAL per "Armonizza tutto" (refactor profondo del sistema).
 *
 * Differenze rispetto a promptLabGlobalRuns:
 * - tipizza azioni multiple (UPDATE/INSERT/MOVE/DELETE)
 * - traccia inventario reale, desiderato e classificazione gap
 * - persiste lo stato di esecuzione per proposta
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toJsonValue } from "@/lib/jsonGuards";

type HarmonizeRunUpdate = Database["public"]["Tables"]["harmonize_runs"]["Update"];

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
  /**
   * True se l'AI ha riconosciuto questo blocco come una NOTA DOCUMENTALE
   * (riferimenti interni, indici, "vedi pag. X", commenti dell'autore, paginazione,
   * meta-istruzioni di redazione) e NON come un contenuto canonico da inserire in KB/prompt.
   * Le note documentali vengono mostrate in un tab dedicato e pre-flaggate "scarta".
   */
  is_document_note?: boolean;
  /** Spiegazione breve del perché l'AI l'ha classificato come nota documentale. */
  document_note_reason?: string;
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

type HarmonizeRunRow = Database["public"]["Tables"]["harmonize_runs"]["Row"];

function asPlainObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Parser runtime di `InventorySummary`: valida `total` numerico e `by_table`
 * come mappa string→number, scartando le chiavi non conformi.
 * Se la forma non è riconoscibile ritorna `{}` (run legacy / colonna vuota).
 */
function parseInventorySummary(value: unknown): InventorySummary | Record<string, never> {
  const obj = asPlainObject(value);
  if (!obj) return {};
  const total = finiteNumber(obj.total);
  const rawByTable = asPlainObject(obj.by_table);
  if (total === null || !rawByTable) return {};
  const by_table: Record<string, number> = {};
  for (const [key, entry] of Object.entries(rawByTable)) {
    const n = finiteNumber(entry);
    if (n !== null) by_table[key] = n;
  }
  return { total, by_table };
}

const GAP_KEYS = ["text_only", "needs_contract", "needs_code_policy", "needs_kb_governance"] as const;

/**
 * Parser runtime di `GapClassification`: richiede le quattro chiavi numeriche.
 * I valori mancanti o non numerici vengono normalizzati a 0; se nessuna chiave
 * è presente il valore è considerato assente e si ritorna `{}`.
 */
function parseGapClassification(value: unknown): GapClassification | Record<string, never> {
  const obj = asPlainObject(value);
  if (!obj) return {};
  if (!GAP_KEYS.some((k) => k in obj)) return {};
  return {
    text_only: finiteNumber(obj.text_only) ?? 0,
    needs_contract: finiteNumber(obj.needs_contract) ?? 0,
    needs_code_policy: finiteNumber(obj.needs_code_policy) ?? 0,
    needs_kb_governance: finiteNumber(obj.needs_kb_governance) ?? 0,
  };
}

function asProposals(value: unknown): HarmonizeProposal[] {
  return Array.isArray(value)
    ? value.filter((p): p is HarmonizeProposal => p !== null && typeof p === "object" && !Array.isArray(p))
    : [];
}

function asUploadedFiles(value: unknown): Array<{ name: string; size: number }> {
  return Array.isArray(value)
    ? value.filter((f): f is { name: string; size: number } =>
        f !== null && typeof f === "object" && typeof (f as { name?: unknown }).name === "string")
    : [];
}

function isHarmonizeStatus(value: unknown): value is HarmonizeStatus {
  return typeof value === "string" &&
    ["collecting", "analyzing", "review", "executing", "done", "cancelled", "failed"].includes(value);
}

function mapHarmonizeRun(row: HarmonizeRunRow): HarmonizeRun {
  return {
    id: row.id,
    user_id: row.user_id,
    goal: row.goal,
    scope: row.scope,
    status: isHarmonizeStatus(row.status) ? row.status : "collecting",
    real_inventory_summary: parseInventorySummary(row.real_inventory_summary),
    desired_inventory_summary: parseInventorySummary(row.desired_inventory_summary),
    gap_classification: parseGapClassification(row.gap_classification),
    proposals: asProposals(row.proposals),
    uploaded_files: asUploadedFiles(row.uploaded_files),
    executed_count: row.executed_count ?? 0,
    failed_count: row.failed_count ?? 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
    completed_at: row.completed_at,
    deleted_at: row.deleted_at,
  };
}

export async function createHarmonizeRun(userId: string, goal: string, scope = "all"): Promise<HarmonizeRun> {
  const { data, error } = await supabase
    .from("harmonize_runs")
    .insert({ user_id: userId, goal, scope, status: "collecting" })
    .select()
    .single();
  if (error) throw error;
  return mapHarmonizeRun(data);
}

export async function updateHarmonizeRun(runId: string, patch: Partial<HarmonizeRun>): Promise<void> {
  const { real_inventory_summary, desired_inventory_summary, gap_classification, proposals, uploaded_files, ...rest } = patch;
  const update: HarmonizeRunUpdate = {
    ...rest,
    ...(real_inventory_summary !== undefined ? { real_inventory_summary: toJsonValue(real_inventory_summary) } : {}),
    ...(desired_inventory_summary !== undefined ? { desired_inventory_summary: toJsonValue(desired_inventory_summary) } : {}),
    ...(gap_classification !== undefined ? { gap_classification: toJsonValue(gap_classification) } : {}),
    ...(proposals !== undefined ? { proposals: toJsonValue(proposals) } : {}),
    ...(uploaded_files !== undefined ? { uploaded_files: toJsonValue(uploaded_files) } : {}),
  };
  const { error } = await supabase
    .from("harmonize_runs")
    .update(update)
    .eq("id", runId);
  if (error) throw error;
}

export async function appendHarmonizeProposal(runId: string, proposal: HarmonizeProposal): Promise<void> {
  const { data, error: readErr } = await supabase
    .from("harmonize_runs")
    .select("proposals")
    .eq("id", runId)
    .single();
  if (readErr) throw readErr;
  const current = asProposals(data?.proposals);
  const existingIndex = current.findIndex((p) => p.id === proposal.id);
  const next = existingIndex >= 0
    ? current.map((p, index) => (index === existingIndex ? proposal : p))
    : [...current, proposal];
  const { error } = await supabase
    .from("harmonize_runs")
    .update({ proposals: toJsonValue(next) })
    .eq("id", runId);
  if (error) throw error;
}

export async function updateHarmonizeProposal(
  runId: string,
  proposalId: string,
  patch: Partial<HarmonizeProposal>,
): Promise<HarmonizeProposal[]> {
  const { data, error: readErr } = await supabase
    .from("harmonize_runs")
    .select("proposals")
    .eq("id", runId)
    .single();
  if (readErr) throw readErr;

  const current = asProposals(data?.proposals);
  let found = false;
  const next = current.map((proposal) => {
    if (proposal.id !== proposalId) return proposal;
    found = true;
    return { ...proposal, ...patch };
  });

  if (!found) throw new Error("Proposta non trovata nel run salvato");

  const { error } = await supabase
    .from("harmonize_runs")
    .update({ proposals: toJsonValue(next) })
    .eq("id", runId);
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
    .from("harmonize_runs")
    .select("proposals, executed_count, failed_count")
    .eq("id", runId)
    .single();
  if (readErr) throw readErr;
  const row = { proposals: asProposals(data?.proposals), executed_count: data?.executed_count ?? 0, failed_count: data?.failed_count ?? 0 };
  const proposals = row.proposals.map((p) =>
    p.id === proposalId ? { ...p, status, ...(failureReason ? { failure_reason: failureReason } : {}) } : p,
  );
  const executedDelta = status === "executed" ? 1 : 0;
  const failedDelta = status === "failed" ? 1 : 0;
  const { error } = await supabase
    .from("harmonize_runs")
    .update({
      proposals: toJsonValue(proposals),
      executed_count: (row.executed_count ?? 0) + executedDelta,
      failed_count: (row.failed_count ?? 0) + failedDelta,
    })
    .eq("id", runId);
  if (error) throw error;
}

export async function findActiveHarmonizeRun(userId: string): Promise<HarmonizeRun | null> {
  const { data, error } = await supabase
    .from("harmonize_runs")
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .in("status", ["collecting", "analyzing", "review", "executing"])
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  const rows = (data ?? []).map(mapHarmonizeRun);
  return rows.length > 0 ? rows[0] : null;
}

export async function cancelHarmonizeRun(runId: string): Promise<void> {
  const { error } = await supabase
    .from("harmonize_runs")
    .update({ status: "cancelled", deleted_at: new Date().toISOString() })
    .eq("id", runId);
  if (error) throw error;
}

export async function findRecentHarmonizeRuns(userId: string, limit = 5): Promise<HarmonizeRun[]> {
  const { data, error } = await supabase
    .from("harmonize_runs")
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(mapHarmonizeRun);
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
    .from("harmonize_runs")
    .select("proposals")
    .eq("id", runId)
    .single();
  if (readErr) throw readErr;

  const current = asProposals(data?.proposals);
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
    .from("harmonize_runs")
    .update({ proposals: toJsonValue(next) })
    .eq("id", runId);
  if (error) throw error;
  return next;
}