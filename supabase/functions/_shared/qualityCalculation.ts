/**
 * qualityCalculation.ts — Computes client quality score from dimensions.
 *
 * Combines:
 * - 4 dimension scores (25% weight each)
 * - Tier mapping
 * - Persistence to database
 */

import type { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { calculateSeniority, calculateIndustry, calculateGeography, calculateEngagement, type ClientData, type DimensionScore } from "./dimensionCalculators.ts";

type SupabaseClient = ReturnType<typeof createClient>;

export interface ClientQualityResult {
  totalScore: number; // 0-100
  tier: "bronze" | "silver" | "gold" | "platinum";
  dimensions: {
    seniority: DimensionScore;
    industry: DimensionScore;
    geography: DimensionScore;
    engagement: DimensionScore;
  };
  calculatedAt: string;
}

/**
 * Calcola il client quality score per un cliente finale.
 *
 * LOVABLE-93: Client Quality Score engine
 */
export async function calculateClientQuality(
  supabase: SupabaseClient,
  clientId: string,
  sourceType: "imported_contact" | "business_card",
): Promise<ClientQualityResult> {
  // Load client data
  const table = sourceType === "imported_contact" ? "imported_contacts" : "business_cards";

  const { data: clientData, error } = await supabase
    .from(table)
    .select("*")
    .eq("id", clientId)
    .maybeSingle();

  if (error || !clientData) {
    throw new Error(`Failed to load ${sourceType} ${clientId}: ${error?.message ?? "Not found"}`);
  }

  const client = clientData as ClientData;

  // Calculate all 4 dimensions
  const seniority = calculateSeniority(client);
  const industry = calculateIndustry(client);
  const geography = calculateGeography(client);
  const engagement = calculateEngagement(client);

  // Weighted total score (each dimension: 25%)
  const totalScore = Math.round(
    seniority.score * 0.25 +
      industry.score * 0.25 +
      geography.score * 0.25 +
      engagement.score * 0.25,
  );

  // Determine tier
  let tier: "bronze" | "silver" | "gold" | "platinum";
  if (totalScore >= 76) {
    tier = "platinum";
  } else if (totalScore >= 51) {
    tier = "gold";
  } else if (totalScore >= 26) {
    tier = "silver";
  } else {
    tier = "bronze";
  }

  const result: ClientQualityResult = {
    totalScore,
    tier,
    dimensions: {
      seniority,
      industry,
      geography,
      engagement,
    },
    calculatedAt: new Date().toISOString(),
  };

  return result;
}

/**
 * Salva il client quality score nei campi JSONB dei clienti.
 *
 * LOVABLE-93: Client Quality Score engine
 */
export async function saveClientQuality(
  supabase: SupabaseClient,
  clientId: string,
  sourceType: "imported_contact" | "business_card",
  result: ClientQualityResult,
): Promise<void> {
  const table = sourceType === "imported_contact" ? "imported_contacts" : "business_cards";

  const { error } = await supabase
    .from(table)
    .update({
      client_quality_score: {
        version: "lovable-93-client-quality-v1",
        totalScore: result.totalScore,
        tier: result.tier,
        dimensions: {
          seniority: result.dimensions.seniority,
          industry: result.dimensions.industry,
          geography: result.dimensions.geography,
          engagement: result.dimensions.engagement,
        },
        calculatedAt: result.calculatedAt,
      },
    })
    .eq("id", clientId);

  if (error) {
    throw new Error(`Failed to save client quality for ${sourceType} ${clientId}: ${error.message}`);
  }
}

/**
 * Wrapper conveniente: calcola e salva in una sola chiamata.
 *
 * LOVABLE-93: Client Quality Score engine
 */
export async function calculateAndSaveClientQuality(
  supabase: SupabaseClient,
  clientId: string,
  sourceType: "imported_contact" | "business_card",
): Promise<ClientQualityResult> {
  const result = await calculateClientQuality(supabase, clientId, sourceType);
  await saveClientQuality(supabase, clientId, sourceType, result);
  return result;
}
