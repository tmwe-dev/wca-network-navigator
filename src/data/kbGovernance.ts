/**
 * DAL — KB canonical governance (audit reports + family stats).
 * Read-only thin wrapper around `kb_audit_reports` and `v_kb_active_canonical`.
 */
import { supabase } from "@/integrations/supabase/client";

export interface KbAuditReport {
  readonly id: string;
  readonly created_at: string;
  readonly triggered_by: string;
  readonly total_entries: number;
  readonly exact_duplicates: number;
  readonly semantic_duplicates: number;
  readonly numbers_outside_canonical: number;
  readonly entries_without_tags: number;
  readonly entries_without_family: number;
  readonly proposed_changes: number;
  readonly family_distribution: Record<string, number>;
  readonly report_markdown: string | null;
}

export interface KbFamilyRow {
  readonly family: string | null;
  readonly count: number;
}

export async function fetchLatestAuditReport(): Promise<KbAuditReport | null> {
  const { data, error } = await supabase
    .from("kb_audit_reports")
    .select("id, created_at, triggered_by, total_entries, exact_duplicates, semantic_duplicates, numbers_outside_canonical, entries_without_tags, entries_without_family, proposed_changes, family_distribution, report_markdown")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as KbAuditReport | null;
}

export async function fetchAuditHistory(limit = 20): Promise<readonly KbAuditReport[]> {
  const { data, error } = await supabase
    .from("kb_audit_reports")
    .select("id, created_at, triggered_by, total_entries, exact_duplicates, semantic_duplicates, numbers_outside_canonical, entries_without_tags, entries_without_family, proposed_changes, family_distribution, report_markdown")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as readonly KbAuditReport[];
}

export async function fetchFamilyDistribution(): Promise<readonly KbFamilyRow[]> {
  // Uses the canonical view; falls back to category if family is null.
  const { data, error } = await supabase
    .from("v_kb_active_canonical")
    .select("family");
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const row of (data ?? []) as Array<{ family: string | null }>) {
    const key = row.family ?? "(unassigned)";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([family, count]) => ({ family, count }))
    .sort((a, b) => b.count - a.count);
}

export interface PendingProposalSummary {
  readonly total: number;
  readonly byOperation: Record<string, number>;
}

export async function fetchPendingProposalsSummary(): Promise<PendingProposalSummary> {
  const { data, error } = await supabase
    .from("kb_entry_proposals")
    .select("operation")
    .eq("status", "pending");
  if (error) throw error;
  const byOperation: Record<string, number> = {};
  for (const row of (data ?? []) as Array<{ operation: string }>) {
    byOperation[row.operation] = (byOperation[row.operation] ?? 0) + 1;
  }
  return { total: data?.length ?? 0, byOperation };
}