/**
 * legacyCompatibility.ts — Legacy function support for backward compatibility
 *
 * Provides legacy function interfaces for existing code that depends on
 * the original PartnerQualityScore interface.
 */

import type { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { calculatePartnerQuality } from "./qualityOrchestrator";
import type { PartnerQualityScore } from "./qualityTypes";

type SupabaseClient = ReturnType<typeof createClient>;

/**
 * Legacy function for backward compatibility
 */
export async function loadAndCalculateQuality(
  supabase: SupabaseClient,
  partnerId: string,
): Promise<PartnerQualityScore> {
  const result = await calculatePartnerQuality(supabase, partnerId);

  return {
    total_score: result.totalScore,
    star_rating: result.stars,
    dimensions: {
      profilo_e_presenza: result.dimensions[0]?.score ?? 0,
      solidita_aziendale: result.dimensions[1]?.score ?? 0,
      servizi_e_capacita: result.dimensions[2]?.score ?? 0,
      intelligence: result.dimensions[3]?.score ?? 0,
    },
    data_completeness_percent: result.dataCompleteness,
    calculated_at: result.calculatedAt,
  };
}
