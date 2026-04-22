/**
 * qualitySaveAndBatch.ts — Partner quality save and batch operations
 *
 * Handles persistence of quality scores and batch processing of multiple partners.
 */

import type { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { calculatePartnerQuality } from "./qualityOrchestrator";
import type { PartnerQualityResult } from "./qualityTypes";

type SupabaseClient = ReturnType<typeof createClient>;

/**
 * Salva il risultato dello score nella tabella partners.
 *
 * LOVABLE-93: Partner Quality Score engine
 */
export async function savePartnerQuality(
  supabase: SupabaseClient,
  partnerId: string,
  result: PartnerQualityResult,
): Promise<void> {
  const { error } = await supabase
    .from("partners")
    .update({
      rating: result.stars,
      rating_details: {
        version: "lovable-93-quality-v2",
        totalScore: result.totalScore,
        stars: result.stars,
        dimensions: result.dimensions,
        dataCompleteness: result.dataCompleteness,
        calculatedAt: result.calculatedAt,
        // LOVABLE-93: WCA logistics value modifier
        wca_modifier: result.wcaModifier?.details,
      },
    })
    .eq("id", partnerId);

  if (error) {
    throw new Error(`Failed to save quality score for partner ${partnerId}: ${error.message}`);
  }
}

/**
 * Wrapper conveniente: calcola e salva in una sola chiamata.
 *
 * LOVABLE-93: Partner Quality Score engine
 */
export async function calculateAndSavePartnerQuality(
  supabase: SupabaseClient,
  partnerId: string,
): Promise<PartnerQualityResult> {
  const result = await calculatePartnerQuality(supabase, partnerId);
  await savePartnerQuality(supabase, partnerId, result);
  return result;
}

/**
 * Recalcola la qualità di più partner in batch.
 *
 * LOVABLE-93: Partner Quality Score engine
 */
export async function batchRecalculatePartnerQuality(
  supabase: SupabaseClient,
  partnerIds: string[],
): Promise<Record<string, PartnerQualityResult>> {
  const results: Record<string, PartnerQualityResult> = {};

  for (const partnerId of partnerIds) {
    try {
      const result = await calculateAndSavePartnerQuality(supabase, partnerId);
      results[partnerId] = result;
    } catch (err) {
      console.error(`Failed to calculate quality for partner ${partnerId}:`, err);
      results[partnerId] = {
        totalScore: 0,
        stars: 1,
        dimensions: [],
        calculatedAt: new Date().toISOString(),
        dataCompleteness: 0,
      };
    }
  }

  return results;
}
