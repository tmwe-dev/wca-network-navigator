/**
 * qualityHelpers.ts — Helper calculation functions for data normalization and sub-scores
 * LOVABLE-93: Partner Quality Score engine helper functions
 */

import type { DetailScore } from "./partnerQualityScore";

/** Extracts a value from enrichment_data with type-safe access. */
export function extractFromEnrichment<T>(
  enrichmentData: Record<string, unknown> | null,
  key: string,
  defaultValue: T
): T {
  if (!enrichmentData || typeof enrichmentData !== "object") {
    return defaultValue;
  }
  const value = enrichmentData[key];
  return value !== undefined && value !== null ? (value as T) : defaultValue;
}

/** Normalizes a score between 0 and 1. */
export function normalizeScore(score: number, maxScore: number): number {
  if (maxScore <= 0) return 0;
  return Math.round((score / maxScore) * 100);
}

/** Calculates years from a date to now. */
export function calculateYearsSince(dateString: string | null): number {
  if (!dateString) return 0;
  const date = new Date(dateString);
  const now = new Date();
  return (
    (now.getTime() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  );
}

/** Checks if a date is in the future. */
export function isDateInFuture(dateString: string | null): boolean {
  if (!dateString) return false;
  return new Date(dateString) > new Date();
}

/** Scores membership years based on tenure brackets. */
export function scoreMembershipYears(dateString: string | null): DetailScore {
  const years = calculateYearsSince(dateString);

  if (years >= 10)
    return {
      score: 25,
      maxScore: 25,
      reason: `${Math.round(years)} anni di membership (10+)`,
    };
  if (years >= 5)
    return {
      score: 20,
      maxScore: 25,
      reason: `${Math.round(years)} anni di membership (5-9)`,
    };
  if (years >= 3)
    return {
      score: 15,
      maxScore: 25,
      reason: `${Math.round(years)} anni di membership (3-4)`,
    };
  if (years >= 1)
    return {
      score: 10,
      maxScore: 25,
      reason: `${Math.round(years)} anni di membership (1-2)`,
    };
  if (years > 0)
    return {
      score: 5,
      maxScore: 25,
      reason: `${Math.round(years * 12)} mesi di membership (<1 anno)`,
    };

  return {
    score: 0,
    maxScore: 25,
    reason: "Data adesione non disponibile",
  };
}

/** Scores contact quality based on available fields. */
export function scoreContactQuality(
  email: string | null,
  phone: string | null,
  name: string | null
): DetailScore {
  if (email && phone)
    return {
      score: 15,
      maxScore: 15,
      reason: "Contatto primario con email e telefono",
    };
  if (email)
    return {
      score: 10,
      maxScore: 15,
      reason: "Contatto primario con email",
    };
  if (name)
    return {
      score: 5,
      maxScore: 15,
      reason: "Contatto primario con solo nome",
    };

  return {
    score: 0,
    maxScore: 15,
    reason: "Nessun contatto primario",
  };
}

/** Scores data freshness based on days since update. */
export function scoreDataFreshness(dateString: string | null): DetailScore {
  if (!dateString)
    return {
      score: 0,
      maxScore: 20,
      reason: "Deep Search mai eseguito",
    };

  const ageInDays =
    (new Date().getTime() - new Date(dateString).getTime()) /
    (24 * 60 * 60 * 1000);

  if (ageInDays <= 30)
    return {
      score: 20,
      maxScore: 20,
      reason: `Deep Search aggiornato (${Math.round(ageInDays)}gg fa)`,
    };
  if (ageInDays <= 60)
    return {
      score: 15,
      maxScore: 20,
      reason: `Deep Search (${Math.round(ageInDays)}gg fa)`,
    };
  if (ageInDays <= 90)
    return {
      score: 10,
      maxScore: 20,
      reason: `Deep Search obsoleto (${Math.round(ageInDays)}gg fa)`,
    };

  return {
    score: 5,
    maxScore: 20,
    reason: `Deep Search vecchio (${Math.round(ageInDays)}gg fa)`,
  };
}

/** Maps total score to star rating. */
export function scoreToStars(totalScore: number): number {
  if (totalScore <= 20) return 1;
  if (totalScore <= 40) return 2;
  if (totalScore <= 60) return 3;
  if (totalScore <= 80) return 4;
  return 5;
}

/** Clamps a value between min and max. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
