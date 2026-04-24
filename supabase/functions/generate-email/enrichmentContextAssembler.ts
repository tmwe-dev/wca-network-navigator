/**
 * enrichmentContextAssembler.ts — Assemble enrichment data, deep search, and partner quality
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import type { Quality } from "../_shared/kbSlice.ts";
import { readUnifiedEnrichment, formatEnrichmentForPrompt } from "../_shared/enrichmentAdapter.ts";
import {
  calculateDeepSearchScore,
  formatScoreForPrompt,
  type DeepSearchScoreResult,
} from "../_shared/deepSearchScore.ts";

// deno-lint-ignore no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any>>;

export interface EnrichmentContext {
  cachedEnrichmentContext: string;
  deepSearchStatus: "fresh" | "cached" | "stale" | "missing" | "skipped" | "failed";
  deepSearchAgeDays: number | null;
  enrichmentAgeDays: number | null;
  sherlockLevel: number;
  lastDeepSearchScore: number | null;
}

/**
 * Load and format cached enrichment data with deep search scoring.
 */
export async function assembleEnrichmentContext(
  supabase: SupabaseClient,
  userId: string,
  partnerId: string | undefined,
  quality: Quality,
  hasInteractionHistory: boolean,
): Promise<EnrichmentContext> {
  const defaultResult: EnrichmentContext = {
    cachedEnrichmentContext: "",
    deepSearchStatus: "missing",
    deepSearchAgeDays: null,
    enrichmentAgeDays: null,
    sherlockLevel: 0,
    lastDeepSearchScore: null,
  };

  if (!partnerId) return defaultResult;

  const unified = await readUnifiedEnrichment(partnerId, supabase);
  const deepSearchAgeDays = unified.freshness.deep_age_days ?? unified.freshness.base_age_days;

  let cachedEnrichmentContext = "";
  let deepSearchStatus: "fresh" | "cached" | "stale" | "missing" | "skipped" | "failed" =
    "missing";
  let dsScore: DeepSearchScoreResult | null = null;
  let sherlockLevel = 0;

  if (unified.has_any) {
    deepSearchStatus = deepSearchAgeDays != null && deepSearchAgeDays > 30 ? "stale" : "cached";
    const block = formatEnrichmentForPrompt(unified, quality);
    if (block) cachedEnrichmentContext = `\n${block}\n`;

    if (deepSearchAgeDays !== null && deepSearchAgeDays > 30) {
      cachedEnrichmentContext += `\nATTENZIONE: dati arricchimento obsoleti (${deepSearchAgeDays} giorni). Usare con cautela — considera di aggiornare con Deep Search.\n`;
    }
  }

  // Calculate Deep Search Score
  const interactionCountResult = await supabase
    .from("interactions")
    .select("id", { count: "exact", head: true })
    .eq("partner_id", partnerId);
  const kbCountResult = await supabase
    .from("kb_entries")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .contains("tags", [`partner_${partnerId}`]);

  dsScore = calculateDeepSearchScore({
    enrichment: unified,
    interactionCount: interactionCountResult.count ?? 0,
    kbEntryCount: kbCountResult.count ?? 0,
    hasActiveConversation: hasInteractionHistory,
  });

  const dsScoreBlock = formatScoreForPrompt(dsScore);
  if (dsScoreBlock) {
    cachedEnrichmentContext += `\n${dsScoreBlock}\n`;
  }

  if (dsScore.auto_enrich_suggested) {
    console.warn(
      `[generate-email] Deep Search Score ${dsScore.score}/100 per partner ${partnerId} — arricchimento consigliato`,
    );
  }

  // Load Partner Quality Score
  try {
    const { loadAndCalculateQuality } = await import("../_shared/partnerQualityScore.ts");
    const qualityScore = await loadAndCalculateQuality(supabase, partnerId);
    const qualityBlock = qualityScore
      ? `PARTNER QUALITY SCORE: ${qualityScore.total_score ?? "?"}/100 (${qualityScore.star_rating ?? "?"}★) — completeness ${qualityScore.data_completeness_percent ?? "?"}%`
      : "";
    if (qualityBlock) {
      cachedEnrichmentContext += `\n${qualityBlock}\n`;
    }
  } catch (e) {
    console.warn(
      "[generate-email] Partner Quality Score calculation failed:",
      e instanceof Error ? e.message : String(e),
    );
  }

  sherlockLevel = ((unified?.sherlock as Record<string, unknown> | undefined)?.level as number | undefined) ?? 0;

  return {
    cachedEnrichmentContext,
    deepSearchStatus,
    deepSearchAgeDays,
    enrichmentAgeDays: deepSearchAgeDays,
    sherlockLevel,
    lastDeepSearchScore: dsScore?.score ?? null,
  };
}
