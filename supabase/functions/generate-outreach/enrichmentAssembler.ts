/**
 * enrichmentAssembler.ts — Unified enrichment reading and quality score assembly.
 * LOVABLE-72, LOVABLE-77, LOVABLE-93: Pulls from base, deep local, legacy, and Sherlock.
 */
import type { Quality } from "../_shared/kbSlice.ts";
import { readUnifiedEnrichment, formatEnrichmentForPrompt } from "../_shared/enrichmentAdapter.ts";

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

export interface RecipientIntelligence {
  sources_checked: string[];
  data_found: Record<string, boolean>;
  enrichment_snippet: string;
  warning: string | null;
}

export async function assemblePartnerEnrichmentContext(
  supabase: SupabaseClient,
  partnerId: string,
  quality: Quality,
  contextParts: string[],
  intelligence: RecipientIntelligence,
): Promise<{ websiteSource: "cached" | "not_available"; linkedinSource: "cached" | "not_available" }> {
  let websiteSource: "cached" | "not_available" = "not_available";
  let linkedinSource: "cached" | "not_available" = "not_available";

  if (quality === "fast") {
    return { websiteSource, linkedinSource };
  }

  try {
    const unified = await readUnifiedEnrichment(partnerId, supabase);
    if (unified.has_any) {
      const block = formatEnrichmentForPrompt(unified, quality);
      if (block) {
        contextParts.push(`[ENRICHMENT UNIFICATO]\n${block}`);
        websiteSource = "cached";
        if (unified.legacy.linkedin_summary || unified.base.linkedin_url) {
          linkedinSource = "cached";
          intelligence.data_found.linkedin = true;
        }
        if (unified.base.website_excerpt || unified.legacy.website_summary) {
          intelligence.data_found.website = true;
        }

        // LOVABLE-93: Add Partner Quality Score
        try {
          const { loadAndCalculateQuality, formatQualityForPrompt } = await import("../_shared/partnerQualityScore.ts");
          const qualityScore = await loadAndCalculateQuality(supabase, partnerId);
          const qualityBlock = formatQualityForPrompt(qualityScore);
          if (qualityBlock) {
            contextParts.push(`[QUALITÀ PARTNER]\n${qualityBlock}`);
          }
        } catch (e) {
          console.warn("[assemblePartnerEnrichmentContext] quality score failed:", e instanceof Error ? e.message : String(e));
        }
      }
    }
  } catch (e) {
    console.warn("[assemblePartnerEnrichmentContext] enrichment read failed:", e instanceof Error ? e.message : e);
  }

  return { websiteSource, linkedinSource };
}

export async function getEnrichmentMetadata(
  supabase: SupabaseClient,
  partnerId: string | null,
  quality: Quality,
): Promise<{ enrichmentAgeDays: number | null; sherlockLevel: number; lastDeepSearchScore: number }> {
  let enrichmentAgeDays: number | null = null;
  let sherlockLevel: number = 0;
  let lastDeepSearchScore: number = 0;

  if (!partnerId || quality === "fast") {
    return { enrichmentAgeDays, sherlockLevel, lastDeepSearchScore };
  }

  try {
    const unified = await readUnifiedEnrichment(partnerId, supabase);
    enrichmentAgeDays = unified.freshness.deep_age_days ?? unified.freshness.base_age_days;
    sherlockLevel = (unified.sherlock?.level as number | undefined) ?? 0;

    // Calculate deep search score
    const { calculateDeepSearchScore } = await import("../_shared/deepSearchScore.ts");
    const interactionCountResult = await supabase
      .from("interactions")
      .select("id", { count: "exact", head: true })
      .eq("partner_id", partnerId);
    const kbCountResult = await supabase
      .from("kb_entries")
      .select("id", { count: "exact", head: true })
      .contains("tags", [`partner_${partnerId}`]);
    const dsScore = calculateDeepSearchScore({
      enrichment: unified,
      interactionCount: interactionCountResult.count ?? 0,
      kbEntryCount: kbCountResult.count ?? 0,
      hasActiveConversation: false,
    });
    lastDeepSearchScore = dsScore.score;
  } catch (e) {
    console.warn("[getEnrichmentMetadata] Oracle metadata assembly failed:", e instanceof Error ? e.message : String(e));
  }

  return { enrichmentAgeDays, sherlockLevel, lastDeepSearchScore };
}
