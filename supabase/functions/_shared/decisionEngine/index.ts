/**
 * decisionEngine/index.ts — Barrel export.
 *
 * Re-exports all public APIs from submodules for backward compatibility.
 * The original decisionEngine.ts can be replaced with this module.
 */

// Type exports
export type { SupabaseClient, AutonomyLevel, ActionType } from "./types.ts";
export type { NextAction, PartnerState, DecisionContext } from "./types.ts";

// Function exports
export { resolveAutonomy } from "./autonomy.ts";
export { decideNextActions } from "./decider.ts";
export { evaluatePartner } from "./evaluator.ts";
