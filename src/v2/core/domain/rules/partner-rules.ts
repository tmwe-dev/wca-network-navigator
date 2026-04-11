/**
 * Partner Domain Rules — STEP 6
 * Regole business: validazione, score completezza.
 */

import { type Result, ok, err } from "../result";
import { domainError, type AppError } from "../errors";
import type { Partner } from "../entities";

// ── Completeness score ───────────────────────────────────────────────

export function partnerCompletenessScore(partner: Partner): number {
  let score = 0;
  const weights = [
    { field: partner.companyName, points: 15 },
    { field: partner.countryCode, points: 10 },
    { field: partner.city, points: 10 },
    { field: partner.email, points: 15 },
    { field: partner.phone, points: 10 },
    { field: partner.website, points: 10 },
    { field: partner.address, points: 5 },
    { field: partner.wcaId, points: 10 },
    { field: partner.memberSince, points: 5 },
    { field: partner.enrichmentData, points: 10 },
  ];

  for (const weight of weights) {
    if (weight.field != null && weight.field !== "") {
      score += weight.points;
    }
  }

  return score;
}

// ── Validation ───────────────────────────────────────────────────────

export function validatePartnerForOutreach(partner: Partner): Result<Partner, AppError> {
  if (!partner.email && !partner.phone) {
    return err(domainError(
      "BUSINESS_RULE_VIOLATED",
      "Partner must have at least one contact method (email or phone) for outreach",
      { partnerId: String(partner.id) },
    ));
  }

  if (partner.isBlacklisted) {
    return err(domainError(
      "BUSINESS_RULE_VIOLATED",
      "Cannot perform outreach to blacklisted partner",
      { partnerId: String(partner.id) },
    ));
  }

  return ok(partner);
}

// ── Enrichment eligibility ───────────────────────────────────────────

export function isEligibleForEnrichment(partner: Partner): boolean {
  if (!partner.wcaId) return false;
  if (partner.enrichmentData) return false;
  return partnerCompletenessScore(partner) < 70;
}
