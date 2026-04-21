/**
 * approvalFlow.ts — Flusso di approvazione e coda esecuzione (LOVABLE-90).
 *
 * Gestisce il ciclo di vita delle azioni AI:
 *   pending → approved → executing → completed | failed
 *   pending → rejected
 *   pending → expired (TTL scaduto)
 *
 * Undo window: azioni "execute" hanno una finestra di annullamento (default 30s)
 * prima dell'esecuzione effettiva.
 *
 * Integra con Decision Engine (LOVABLE-89) per autonomia:
 *   - "suggest" → mostra solo, non accoda
 *   - "prepare" → accoda come pending, richiede approvazione
 *   - "execute" → accoda come approved con undo window
 *   - "autopilot" → esegue immediatamente
 */

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

import type { NextAction, AutonomyLevel } from "./decisionEngine.ts";

export type ApprovalStatus =
  | "pending"
  | "approved"
  | "executing"
  | "completed"
  | "failed"
  | "rejected"
  | "expired"
  | "undone";

export interface QueuedAction {
  id?: string;
  user_id: string;
  partner_id: string;
  action_type: string;
  action_payload: Record<string, unknown>;
  reasoning: string;
  confidence: number;
  source: string;
  status: ApprovalStatus;
  autonomy_level: AutonomyLevel;
  /** ISO timestamp — azione eseguibile dopo questa data (undo window) */
  execute_after?: string;
  /** ISO timestamp — azione scade se non approvata entro questa data */
  expires_at?: string;
  /** Journalist role se applicabile */
  journalist_role?: string;
  /** Priorità dall'engine */
  priority?: number;
}

export interface ApprovalFlowResult {
  queued: boolean;
  executed: boolean;
  action_id?: string;
  status: ApprovalStatus | "suggested";
  message: string;
  undo_until?: string;
}

/** Configurazione undo window in secondi per autonomy level */
const UNDO_WINDOW_SECONDS: Record<AutonomyLevel, number> = {
  suggest: 0,
  prepare: 0,
  execute: 30,
  autopilot: 0,
};

/** TTL per azioni pending (ore) */
const PENDING_TTL_HOURS = 48;

/**
 * Processa un NextAction dal Decision Engine attraverso il flusso di approvazione.
 *
 * - suggest → restituisce suggerimento, nulla in coda
 * - prepare → accoda come pending
 * - execute → accoda come approved con undo window
 * - autopilot → esegue immediatamente (placeholder, chiama executor)
 */
export async function processDecisionAction(
  supabase: SupabaseClient,
  userId: string,
  partnerId: string,
  action: NextAction,
): Promise<ApprovalFlowResult> {
  const autonomy = action.autonomy;

  // ── SUGGEST: solo suggerimento, non accoda ──
  if (autonomy === "suggest") {
    return {
      queued: false,
      executed: false,
      status: "suggested",
      message: `Suggerimento: ${action.reasoning}`,
    };
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + PENDING_TTL_HOURS * 3600000);

  const queueEntry: Record<string, unknown> = {
    user_id: userId,
    partner_id: partnerId,
    action_type: action.action,
    action_payload: {
      channel: action.channel,
      journalist_role: action.journalist_role,
      due_in_days: action.due_in_days,
      priority: action.priority,
      context: action.context,
    },
    reasoning: action.reasoning,
    confidence: autonomy === "autopilot" ? 0.95 : autonomy === "execute" ? 0.85 : 0.7,
    source: "decision_engine",
    autonomy_level: autonomy,
    priority: action.priority,
    expires_at: expiresAt.toISOString(),
  };

  // ── PREPARE: accoda come pending ──
  if (autonomy === "prepare") {
    queueEntry.status = "pending";
    const { data, error } = await supabase
      .from("ai_pending_actions")
      .insert(queueEntry)
      .select("id")
      .single();

    if (error) {
      console.error("[approval-flow] Queue error:", error);
      return {
        queued: false,
        executed: false,
        status: "failed",
        message: `Errore accodamento: ${error.message}`,
      };
    }

    return {
      queued: true,
      executed: false,
      action_id: data.id,
      status: "pending",
      message: `Azione "${action.action}" in attesa di approvazione. Reasoning: ${action.reasoning}`,
    };
  }

  // ── EXECUTE: accoda come approved con undo window ──
  if (autonomy === "execute") {
    const undoSeconds = UNDO_WINDOW_SECONDS.execute;
    const executeAfter = new Date(now.getTime() + undoSeconds * 1000);

    queueEntry.status = "approved";
    queueEntry.execute_after = executeAfter.toISOString();

    const { data, error } = await supabase
      .from("ai_pending_actions")
      .insert(queueEntry)
      .select("id")
      .single();

    if (error) {
      console.error("[approval-flow] Queue error:", error);
      return {
        queued: false,
        executed: false,
        status: "failed",
        message: `Errore accodamento: ${error.message}`,
      };
    }

    return {
      queued: true,
      executed: false,
      action_id: data.id,
      status: "approved",
      message: `Azione "${action.action}" approvata automaticamente. Finestra annullamento: ${undoSeconds}s.`,
      undo_until: executeAfter.toISOString(),
    };
  }

  // ── AUTOPILOT: accoda come approved senza undo (esecuzione immediata) ──
  if (autonomy === "autopilot") {
    queueEntry.status = "approved";
    queueEntry.execute_after = now.toISOString(); // eseguibile subito

    const { data, error } = await supabase
      .from("ai_pending_actions")
      .insert(queueEntry)
      .select("id")
      .single();

    if (error) {
      console.error("[approval-flow] Queue error:", error);
      return {
        queued: false,
        executed: false,
        status: "failed",
        message: `Errore accodamento: ${error.message}`,
      };
    }

    return {
      queued: true,
      executed: false, // L'executor esterno processerà
      action_id: data.id,
      status: "approved",
      message: `Azione "${action.action}" in autopilot — esecuzione immediata.`,
    };
  }

  // Fallback (non dovrebbe mai arrivarci)
  return {
    queued: false,
    executed: false,
    status: "suggested",
    message: "Livello autonomia non riconosciuto",
  };
}

/**
 * Annulla un'azione nella finestra di undo.
 */
export async function undoAction(
  supabase: SupabaseClient,
  actionId: string,
  userId: string,
): Promise<{ success: boolean; message: string }> {
  // Carica l'azione
  const { data: action, error: fetchError } = await supabase
    .from("ai_pending_actions")
    .select("id, status, execute_after")
    .eq("id", actionId)
    .eq("user_id", userId)
    .single();

  if (fetchError || !action) {
    return { success: false, message: "Azione non trovata" };
  }

  // Verifica che sia annullabile
  if (action.status !== "approved") {
    return { success: false, message: `Azione in stato "${action.status}" — non annullabile` };
  }

  // Verifica finestra undo
  if (action.execute_after) {
    const executeAfter = new Date(action.execute_after);
    if (new Date() >= executeAfter) {
      return { success: false, message: "Finestra di annullamento scaduta" };
    }
  }

  const { error: updateError } = await supabase
    .from("ai_pending_actions")
    .update({ status: "undone" })
    .eq("id", actionId)
    .eq("user_id", userId);

  if (updateError) {
    return { success: false, message: `Errore annullamento: ${updateError.message}` };
  }

  return { success: true, message: "Azione annullata con successo" };
}

/**
 * Processa tutte le NextAction dal Decision Engine per un partner.
 * Restituisce un array di risultati, uno per azione.
 */
export async function processAllDecisionActions(
  supabase: SupabaseClient,
  userId: string,
  partnerId: string,
  actions: NextAction[],
): Promise<ApprovalFlowResult[]> {
  const results: ApprovalFlowResult[] = [];
  for (const action of actions) {
    const result = await processDecisionAction(supabase, userId, partnerId, action);
    results.push(result);
  }
  return results;
}

/**
 * Recupera azioni in scadenza (pending da più di TTL) e le marca come expired.
 * Da chiamare periodicamente (cron / edge function).
 */
export async function expireStaleActions(
  supabase: SupabaseClient,
): Promise<{ expired_count: number }> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("ai_pending_actions")
    .update({ status: "expired" })
    .eq("status", "pending")
    .lt("expires_at", now)
    .select("id");

  if (error) {
    console.error("[approval-flow] Expire error:", error);
    return { expired_count: 0 };
  }

  return { expired_count: data?.length ?? 0 };
}

/**
 * Dashboard summary: conta azioni per stato per l'utente.
 */
export async function getApprovalDashboard(
  supabase: SupabaseClient,
  userId: string,
): Promise<{
  pending: number;
  approved: number;
  executing: number;
  completed_today: number;
  failed_today: number;
  rejected_today: number;
  undone_today: number;
}> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayISO = todayStart.toISOString();

  const [
    { count: pending },
    { count: approved },
    { count: executing },
    { count: completedToday },
    { count: failedToday },
    { count: rejectedToday },
    { count: undoneToday },
  ] = await Promise.all([
    supabase.from("ai_pending_actions").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "pending"),
    supabase.from("ai_pending_actions").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "approved"),
    supabase.from("ai_pending_actions").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "executing"),
    supabase.from("ai_pending_actions").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "completed").gte("created_at", todayISO),
    supabase.from("ai_pending_actions").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "failed").gte("created_at", todayISO),
    supabase.from("ai_pending_actions").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "rejected").gte("created_at", todayISO),
    supabase.from("ai_pending_actions").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "undone").gte("created_at", todayISO),
  ]);

  return {
    pending: pending ?? 0,
    approved: approved ?? 0,
    executing: executing ?? 0,
    completed_today: completedToday ?? 0,
    failed_today: failedToday ?? 0,
    rejected_today: rejectedToday ?? 0,
    undone_today: undoneToday ?? 0,
  };
}
