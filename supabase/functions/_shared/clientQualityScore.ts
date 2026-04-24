/**
 * clientQualityScore.ts — Sistema di valutazione della qualità clienti finali (LOVABLE-93)
 *
 * REFACTORED: Thin orchestrator with backward-compatible exports.
 * Actual calculation split into:
 * - dimensionCalculators.ts (4 dimension functions)
 * - qualityCalculation.ts (aggregation & persistence)
 * - qualityFormatting.ts (display formatting)
 *
 * Calcola uno score 0-100 per clienti finali (imported_contacts e business_cards).
 * SEPARATO dal partner quality score — applica a clienti, non a partner/forwarders WCA.
 *
 * Dimensioni di valutazione (0-100 ciascuna, peso 25% ognuna):
 *   1. Seniority / Anzianità (25%) — tempo come cliente (created_at, converted_at, last_interaction_at)
 *   2. Industry Sector / Settore Merceologico (25%) — rilevanza logistica e volume spedizioni
 *   3. Geography / Posizione Geografica (25%) — sviluppo mercato logistico per paese
 *   4. Engagement / Coinvolgimento (25%) — contatti, lead status, interazioni recenti
 *
 * Tier mapping:
 *   0-25 → Bronze
 *   26-50 → Silver
 *   51-75 → Gold
 *   76-100 → Platinum
 *
 * Aggiorna imported_contacts.client_quality_score (JSONB) o business_cards.client_quality_score.
 */

import type { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// deno-lint-ignore no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any>>;

// Re-export all public types and functions from sub-modules
export type { DimensionScore, ClientData } from "./dimensionCalculators.ts";
export { INDUSTRY_SCORING, COUNTRY_TIER_SCORING, calculateSeniority, calculateIndustry, calculateGeography, calculateEngagement } from "./dimensionCalculators.ts";

export type { ClientQualityResult } from "./qualityCalculation.ts";
export { calculateClientQuality, saveClientQuality, calculateAndSaveClientQuality } from "./qualityCalculation.ts";

export { formatClientQualityForPrompt, formatClientQualityShort } from "./qualityFormatting.ts";

/**
 * Main entry point for full pipeline: calculate and save in one call.
 * This is the most commonly used function.
 *
 * LOVABLE-93: Client Quality Score engine
 */
export async function clientQualityScoreFullPipeline(
  supabase: SupabaseClient,
  clientId: string,
  sourceType: "imported_contact" | "business_card",
): Promise<any> {
  const { calculateAndSaveClientQuality } = await import("./qualityCalculation.ts");
  return calculateAndSaveClientQuality(supabase, clientId, sourceType);
}
