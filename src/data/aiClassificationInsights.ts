/**
 * DAL — ai_classification_insights
 * Proposte di apprendimento generate dal Refiner quando l'utente corregge
 * il gruppo email suggerito dall'AI.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

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

type InsightRow = Database["public"]["Tables"]["ai_classification_insights"]["Row"];

const INSIGHT_STATUSES: InsightStatus[] = ["pending", "applied", "rejected", "superseded"];
const INSIGHT_TARGETS: InsightTarget[] = ["group", "prompt"];

function toInsightStatus(value: string): InsightStatus {
  return (INSIGHT_STATUSES as string[]).includes(value) ? (value as InsightStatus) : "pending";
}

function toInsightTarget(value: string): InsightTarget {
  return (INSIGHT_TARGETS as string[]).includes(value) ? (value as InsightTarget) : "group";
}

function mapInsightRow(row: InsightRow): ClassificationInsight {
  return {
    id: row.id,
    trigger_address: row.trigger_address,
    trigger_address_rule_id: row.trigger_address_rule_id,
    ai_suggested_group_name: row.ai_suggested_group_name,
    ai_suggested_group_id: row.ai_suggested_group_id,
    user_chosen_group_name: row.user_chosen_group_name,
    user_chosen_group_id: row.user_chosen_group_id,
    sample_message_ids: row.sample_message_ids ?? [],
    sample_subjects: row.sample_subjects ?? [],
    proposed_target: toInsightTarget(row.proposed_target),
    proposed_target_id: row.proposed_target_id,
    proposed_target_name: row.proposed_target_name,
    change_type: row.change_type,
    proposed_change_text: row.proposed_change_text,
    reasoning: row.reasoning,
    confidence: row.confidence,
    user_note: row.user_note,
    status: toInsightStatus(row.status),
    created_at: row.created_at,
    applied_at: row.applied_at,
    applied_change_summary: row.applied_change_summary,
    rejected_at: row.rejected_at,
    rejection_reason: row.rejection_reason,
  };
}

export async function listClassificationInsights(
  status: InsightStatus = "pending",
  limit = 50,
): Promise<ClassificationInsight[]> {
  const { data, error } = await supabase
    .from("ai_classification_insights")
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(mapInsightRow);
}

export async function countPendingInsights(): Promise<number> {
  const { count, error } = await supabase
    .from("ai_classification_insights")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) throw error;
  return count ?? 0;
}

export async function rejectInsight(id: string, reason?: string): Promise<void> {
  const { error } = await supabase
    .from("ai_classification_insights")
    .update({
      status: "rejected",
      rejected_at: new Date().toISOString(),
      rejection_reason: reason ?? null,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function updateInsightDraft(
  id: string,
  patch: { proposed_change_text?: string; user_note?: string },
): Promise<void> {
  const { error } = await supabase
    .from("ai_classification_insights")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}
