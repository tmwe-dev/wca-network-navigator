/**
 * decisionEngine/autonomy.ts — Autonomy level resolution logic.
 *
 * Determines the effective autonomy level based on:
 * - Ideal autonomy from decision logic
 * - User preference ceiling
 * - Global error rate degradation
 */

import { AutonomyLevel, DecisionContext } from "./types.ts";

/**
 * Risolve il livello di autonomia effettivo.
 * Degrada verso "suggest" se: error rate alto, utente preferisce controllo.
 *
 * @param ideal - The ideal autonomy level from decision logic
 * @param ctx - Decision context with user preference and error rate
 * @returns The effective autonomy level after applying constraints
 */
export function resolveAutonomy(
  ideal: AutonomyLevel,
  ctx: DecisionContext,
): AutonomyLevel {
  const levels: AutonomyLevel[] = ["suggest", "prepare", "execute", "autopilot"];
  const idealIdx = levels.indexOf(ideal);
  const userMaxIdx = levels.indexOf(ctx.userAutonomyPreference);

  // Non superare mai la preferenza utente
  let effectiveIdx = Math.min(idealIdx, userMaxIdx);

  // Degrada se error rate alto
  if (ctx.globalErrorRate > 0.1) {
    effectiveIdx = Math.max(0, effectiveIdx - 1);
  }
  if (ctx.globalErrorRate > 0.25) {
    effectiveIdx = 0; // Force suggest
  }

  return levels[effectiveIdx];
}
