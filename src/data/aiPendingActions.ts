/**
 * DAL — ai_pending_actions (+ side effects su ai_decision_log e agents).
 *
 * Estratto dai bypass DAL diretti di `PendingActionsPanel`.
 * Query, filtri, select, order, limit e semantica errori sono preservati 1:1.
 */
import { supabase } from "@/integrations/supabase/client";

export interface PendingActionFilters {
  /** "all" = nessun filtro su action_type */
  readonly actionType: string;
  /** "all" = nessun filtro su source */
  readonly source: string;
}

/** Elenco azioni pending (max 50, più recenti prima), con partner joinato. */
export async function findPendingAiActions(filters: PendingActionFilters) {
  let q = supabase
    .from("ai_pending_actions")
    .select("*, partners(company_name)")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(50);
  if (filters.actionType !== "all") q = q.eq("action_type", filters.actionType);
  if (filters.source !== "all") q = q.eq("source", filters.source);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

/** Update generico su una pending action (errore propagato). */
export async function updatePendingAction(id: string, payload: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from("ai_pending_actions").update(payload as never).eq("id", id);
  if (error) throw error;
}

/** Traccia la review umana sul decision log collegato (errore ignorato, come il legacy). */
export async function setDecisionLogReview(
  decisionLogId: string,
  review: "approved" | "rejected",
  correction?: string | null,
): Promise<void> {
  const patch = review === "approved"
    ? { user_review: "approved" }
    : { user_review: "rejected", user_correction: correction ?? null };
  await supabase.from("ai_decision_log").update(patch).eq("id", decisionLogId);
}

/** Agenti attivi non eliminati dell'utente (id + system_prompt). */
export async function findActiveAgentPrompts(userId: string) {
  const { data } = await supabase
    .from("agents")
    .select("id, system_prompt")
    .is("deleted_at", null)
    .eq("user_id", userId)
    .eq("is_active", true);
  return data ?? [];
}

/** Aggiorna il system_prompt di un agente. */
export async function updateAgentSystemPrompt(agentId: string, systemPrompt: string): Promise<void> {
  await supabase.from("agents").update({ system_prompt: systemPrompt }).eq("id", agentId);
}
