/**
 * qualityOrchestrator.ts — Main orchestrator for partner quality calculation
 *
 * Coordinates the four quality dimensions and applies the WCA modifier.
 */

import type { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  calculateProfilePresence,
  calculateBusinessSolidity,
  calculateServicesCapacity,
  calculateDeepIntelligence,
} from "./dimensionCalculators.ts";
import { calculateDataCompleteness } from "./dataCompletenessCalculator.ts";
import { calculateWCAModifier } from "./wcaModifierCalculator.ts";
import { scoreToStars } from "./qualityHelpers.ts";
import type { PartnerData, PartnerQualityResult } from "./qualityTypes.ts";

type SupabaseClient = ReturnType<typeof createClient>;

/**
 * Calcola lo score di qualità partner per un singolo partner.
 *
 * LOVABLE-93: Partner Quality Score engine
 */
export async function calculatePartnerQuality(
  supabase: SupabaseClient,
  partnerId: string,
): Promise<PartnerQualityResult> {
  // Carica dati partner
  const { data: partnerData, error } = await supabase
    .from("partners")
    .select(
      "id, raw_profile_markdown, ai_parsed_at, website, linkedin_url, logo_url, member_since, membership_expires, office_type, has_branches, branch_cities, enrichment_data, partner_type, country_code",
    )
    .eq("id", partnerId)
    .maybeSingle();

  if (error || !partnerData) {
    throw new Error(`Failed to load partner ${partnerId}: ${error?.message ?? "Not found"}`);
  }

  const partner = partnerData as PartnerData;

  // Calculate all 4 dimensions
  const [dimension1, dimension2, dimension3, dimension4] = await Promise.all([
    calculateProfilePresence(supabase, partnerId, partner),
    calculateBusinessSolidity(supabase, partnerId, partner),
    calculateServicesCapacity(supabase, partnerId, partner),
    calculateDeepIntelligence(supabase, partnerId, partner),
  ]);

  const dimensions = [dimension1, dimension2, dimension3, dimension4];

  // Weighted total score (before WCA modifier)
  const baseScore = Math.round(
    dimension1.score * dimension1.weight +
      dimension2.score * dimension2.weight +
      dimension3.score * dimension3.weight +
      dimension4.score * dimension4.weight,
  );

  // LOVABLE-93: Apply WCA Logistics Value modifier
  const { modifier, details } = await calculateWCAModifier(supabase, partnerId, partner);
  const totalScore = Math.max(0, Math.min(100, baseScore + modifier));

  const stars = scoreToStars(totalScore);

  // Data completeness
  const dataCompleteness = await calculateDataCompleteness(supabase, partnerId, partner);

  const result: PartnerQualityResult = {
    totalScore,
    stars,
    dimensions,
    calculatedAt: new Date().toISOString(),
    dataCompleteness,
    wcaModifier: {
      modifier,
      details,
    },
  };

  return result;
}
