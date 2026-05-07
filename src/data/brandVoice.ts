/**
 * DAL — Brand Voice metrics.
 * Read-only access to `v_brand_voice_outcomes` (aggregated) and
 * `brand_voice_audits` (raw recent deviations).
 * Layer rule: only this file may touch these tables/views from FE.
 */
import { supabase } from "@/integrations/supabase/client";

export interface BrandVoiceOutcomeRow {
  readonly day: string;
  readonly channel: string;
  readonly journalist_role: string | null;
  readonly audits: number;
  readonly avg_score: number;
  readonly low_score_count: number;
  readonly high_score_count: number;
}

export interface BrandVoiceAuditRow {
  readonly id: string;
  readonly created_at: string;
  readonly channel: string;
  readonly journalist_role: string | null;
  readonly score: number;
  readonly deviations: ReadonlyArray<string>;
  readonly excerpt: string | null;
  readonly outreach_message_id: string | null;
}

export async function fetchBrandVoiceOutcomes(): Promise<BrandVoiceOutcomeRow[]> {
  const { data, error } = await supabase
    .from("v_brand_voice_outcomes" as never)
    .select("day, channel, journalist_role, audits, avg_score, low_score_count, high_score_count")
    .order("day", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as unknown as BrandVoiceOutcomeRow[];
}

export async function fetchRecentBrandVoiceAudits(limit = 50): Promise<BrandVoiceAuditRow[]> {
  const { data, error } = await supabase
    .from("brand_voice_audits" as never)
    .select("id, created_at, channel, journalist_role, score, deviations, excerpt, outreach_message_id")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as BrandVoiceAuditRow[];
}

export interface DeviationCount {
  readonly code: string;
  readonly count: number;
}

/** Aggrega le deviazioni più frequenti dagli audit recenti. */
export function topDeviations(audits: ReadonlyArray<BrandVoiceAuditRow>, top = 10): DeviationCount[] {
  const counts = new Map<string, number>();
  for (const a of audits) {
    for (const d of a.deviations ?? []) {
      counts.set(d, (counts.get(d) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, top);
}