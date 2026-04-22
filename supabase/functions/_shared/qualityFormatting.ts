/**
 * qualityFormatting.ts — Display and prompt formatting for client quality scores.
 *
 * Provides:
 * - Formatted output for prompts
 * - Short summary format
 * - Readable dimension breakdown
 */

import type { ClientQualityResult } from "./qualityCalculation.ts";

/**
 * Formatta il client quality score in formato leggibile per i prompt.
 *
 * LOVABLE-93: Client Quality Score engine
 */
export function formatClientQualityForPrompt(result: ClientQualityResult): string {
  const tierEmoji = {
    bronze: "🥉",
    silver: "🥈",
    gold: "🥇",
    platinum: "💎",
  };

  const lines = [
    `QUALITÀ CLIENTE: ${tierEmoji[result.tier]} ${result.tier.toUpperCase()} (${result.totalScore}/100)`,
    `- Anzianità: ${result.dimensions.seniority.score}/100 (${result.dimensions.seniority.details.band || "sconosciuto"})`,
    `- Settore: ${result.dimensions.industry.score}/100 (${result.dimensions.industry.details.industry || "sconosciuto"})`,
    `- Geografia: ${result.dimensions.geography.score}/100 (${result.dimensions.geography.details.tier})`,
    `- Coinvolgimento: ${result.dimensions.engagement.score}/100 (${result.dimensions.engagement.details.lead_status || "unknown"})`,
  ];

  return lines.join("\n");
}

/**
 * Versione semplificata del formatting (una riga sola).
 *
 * LOVABLE-93: Client Quality Score engine
 */
export function formatClientQualityShort(result: ClientQualityResult): string {
  const tierEmoji = {
    bronze: "🥉",
    silver: "🥈",
    gold: "🥇",
    platinum: "💎",
  };

  return `${tierEmoji[result.tier]} ${result.tier.toUpperCase()} (${result.totalScore}/100)`;
}
