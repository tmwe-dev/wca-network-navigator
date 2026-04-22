/**
 * partnerQualityScore.ts — Main orchestrator for partner quality scoring (LOVABLE-93)
 *
 * Calculates 1-5 star rating based on 4 quality dimensions + WCA logistics modifier.
 * Aggiorna automaticamente partners.rating e partners.rating_details.
 *
 * This file now serves as a thin orchestrator that imports and re-exports
 * from specialized modules for better code organization.
 */

// ════════════════════════════════════════════════════════════════════
// TYPE EXPORTS
// ════════════════════════════════════════════════════════════════════

export type {
  DetailScore,
  QualityDimension,
  PartnerQualityResult,
  PartnerQualityScore,
  PartnerData,
  WCAModifierBonus,
  WCAModifierDetails,
} from "./qualityTypes.ts";

// ════════════════════════════════════════════════════════════════════
// CALCULATION ORCHESTRATION
// ════════════════════════════════════════════════════════════════════

export { calculatePartnerQuality } from "./qualityOrchestrator.ts";

// ════════════════════════════════════════════════════════════════════
// SAVE AND BATCH OPERATIONS
// ════════════════════════════════════════════════════════════════════

export { savePartnerQuality, calculateAndSavePartnerQuality, batchRecalculatePartnerQuality } from "./qualitySaveAndBatch.ts";

// ════════════════════════════════════════════════════════════════════
// LEGACY COMPATIBILITY
// ════════════════════════════════════════════════════════════════════

export { loadAndCalculateQuality } from "./legacyCompatibility.ts";

// ════════════════════════════════════════════════════════════════════
// INTERNAL MODULE EXPORTS (for testing and advanced use)
// ════════════════════════════════════════════════════════════════════

export {
  calculateProfilePresence,
  calculateBusinessSolidity,
  calculateServicesCapacity,
  calculateDeepIntelligence,
} from "./dimensionCalculators.ts";

export { calculateDataCompleteness } from "./dataCompletenessCalculator.ts";

export { calculateWCAModifier } from "./wcaModifierCalculator.ts";
