/**
 * DAL — ai_decision_log
 */
import { supabase } from "@/integrations/supabase/client";

export interface DecisionLogEntry {
  id: string;
  decision_type: string;
  ai_reasoning: string | null;
  confidence: number | null;
  was_auto_executed: boolean;
  user_review: string | null;
  created_at: string;
}

/** Log recenti per un indirizzo email specifico. */
export async function findDecisionLogsByEmail(emailAddress: string, limit = 10): Promise<DecisionLogEntry[]> {
  const { data, error } = await supabase
    .from("ai_decision_log")
    .select("id, decision_type, ai_reasoning, confidence, was_auto_executed, user_review, created_at")
    .eq("email_address", emailAddress)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as DecisionLogEntry[];
}

export interface DecisionKpiRow {
  was_auto_executed: boolean | null;
  user_review: string | null;
}

/** Righe per KPI aggregati su una finestra temporale. */
export async function findDecisionLogKpiRows(sinceIso: string): Promise<DecisionKpiRow[]> {
  const { data, error } = await supabase
    .from("ai_decision_log")
    .select("was_auto_executed, user_review")
    .gte("created_at", sinceIso);
  if (error) throw error;
  return data ?? [];
}

export interface DecisionTypeRow {
  decision_type: string;
  was_auto_executed: boolean | null;
  user_review: string | null;
}

/** Righe per statistiche aggregate per tipo di decisione. */
export async function findDecisionLogTypeRows(sinceIso: string): Promise<DecisionTypeRow[]> {
  const { data, error } = await supabase
    .from("ai_decision_log")
    .select("decision_type, was_auto_executed, user_review")
    .gte("created_at", sinceIso);
  if (error) throw error;
  return data ?? [];
}

export interface DecisionCriticalRow {
  email_address: string | null;
  user_review: string | null;
  partner_id: string | null;
  partners?: { company_name?: string } | null;
}

/** Righe per contatti critici (join partners per company_name). */
export async function findDecisionLogCriticalRows(sinceIso: string): Promise<DecisionCriticalRow[]> {
  const { data, error } = await supabase
    .from("ai_decision_log")
    .select("email_address, user_review, partner_id, partners(company_name)")
    .not("email_address", "is", null)
    .gte("created_at", sinceIso);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    email_address: r.email_address,
    user_review: r.user_review,
    partner_id: r.partner_id,
    partners: r.partners ? { company_name: r.partners.company_name } : null,
  }));
}

export interface LearningDecisionRow {
  decision_type: string;
  email_address: string | null;
  confidence: number | null;
  user_review: string | null;
  was_auto_executed: boolean;
}

/** Righe per la dashboard di learning (ultimi 30 giorni). */
export async function findLearningDecisions(sinceIso: string): Promise<LearningDecisionRow[]> {
  const { data, error } = await supabase
    .from("ai_decision_log")
    .select("decision_type, email_address, confidence, user_review, was_auto_executed")
    .gte("created_at", sinceIso);
  if (error) throw error;
  return (data || []) as LearningDecisionRow[];
}

export interface RecentFeedbackRow {
  id: string;
  decision_type: string;
  ai_reasoning: string | null;
  confidence: number | null;
  user_review: string | null;
  user_correction: string | null;
  email_address: string | null;
  created_at: string | null;
}

/** Ultimi feedback registrati (user_review non nullo). */
export async function findRecentFeedbackDecisions(limit = 10): Promise<RecentFeedbackRow[]> {
  const { data, error } = await supabase
    .from("ai_decision_log")
    .select("id, decision_type, ai_reasoning, confidence, user_review, user_correction, email_address, created_at")
    .not("user_review", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export interface DecisionLogPageParams {
  typeFilter?: string;
  autoOnly?: boolean;
  searchEmail?: string;
  page: number;
  pageSize: number;
}

/** Elenco paginato con filtri e join partners (usato da DecisionLogPanel). */
export async function findDecisionLogPage(params: DecisionLogPageParams) {
  const { typeFilter, autoOnly, searchEmail, page, pageSize } = params;
  let q = supabase
    .from("ai_decision_log")
    .select("*, partners(company_name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);
  if (typeFilter && typeFilter !== "all") q = q.eq("decision_type", typeFilter);
  if (autoOnly) q = q.eq("was_auto_executed", true);
  if (searchEmail && searchEmail.trim()) q = q.ilike("email_address", `%${searchEmail.trim()}%`);
  const { data: rows, error, count } = await q;
  if (error) throw error;
  return { rows: rows ?? [], total: count ?? 0 };
}
