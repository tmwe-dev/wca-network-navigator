/**
 * DAL — ai_classification_insights
 * Proposte di apprendimento generate dal Refiner quando l'utente corregge
 * il gruppo email suggerito dall'AI.
 */
import { untypedFrom } from "@/lib/supabaseUntyped";

export type InsightStatus = "pending" | "applied" | "rejected" | "superseded";
export type InsightTarget = "group" | "prompt";

export interface ClassificationInsight {
  id: string;
  trigger_address: string;
  trigger_address_rule_id: string | null;
  ai_suggested_group_name: string | null;
  ai_suggested_group_id: string | null;
  user_chosen_group_name: string;
  user_chosen_group_id: string;
  sample_message_ids: string[];
  sample_subjects: string[];
  proposed_target: InsightTarget;
  proposed_target_id: string | null;
  proposed_target_name: string | null;
  change_type: string;
  proposed_change_text: string;
  reasoning: string | null;
  confidence: number | null;
  user_note: string | null;
  status: InsightStatus;
  created_at: string;
  applied_at: string | null;
  applied_change_summary: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
}

export async function listClassificationInsights(
  status: InsightStatus = "pending",
  limit = 50,
): Promise<ClassificationInsight[]> {
  const { data, error } = await untypedFrom("ai_classification_insights")
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as ClassificationInsight[];
}

export async function countPendingInsights(): Promise<number> {
  const { count, error } = await untypedFrom("ai_classification_insights")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) throw error;
  return count ?? 0;
}

export async function rejectInsight(id: string, reason?: string): Promise<void> {
  const { error } = await untypedFrom("ai_classification_insights")
    .update({
      status: "rejected",
      rejected_at: new Date().toISOString(),
      rejection_reason: reason ?? null,
    } as never)
    .eq("id", id);
  if (error) throw error;
}

export async function updateInsightDraft(
  id: string,
  patch: { proposed_change_text?: string; user_note?: string },
): Promise<void> {
  const { error } = await untypedFrom("ai_classification_insights")
    .update(patch as never)
    .eq("id", id);
  if (error) throw error;
}