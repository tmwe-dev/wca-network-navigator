/**
 * decisionEngine.ts — Matrice decisionale + autonomia (LOVABLE-89).
 *
 * REFACTORED: This file now serves as a thin barrel that re-exports everything
 * from the modular decisionEngine/ subdirectory for backward compatibility.
 *
 * The actual implementation is split into logical modules:
 *   - decisionEngine/types.ts — Type definitions
 *   - decisionEngine/autonomy.ts — Autonomy resolution logic
 *   - decisionEngine/rules.ts — Decision rules by lead status
 *   - decisionEngine/decider.ts — Main decision orchestrator
 *   - decisionEngine/evaluator.ts — Partner state loading and evaluation
 *   - decisionEngine/index.ts — Barrel export of all public APIs
 *
 * Data una situazione (partner state + history + enrichment + tempo),
 * il Decision Engine decide la PROSSIMA AZIONE e il livello di autonomia.
 *
 * 4 livelli di autonomia:
 *   1. SUGGEST — mostra suggerimento, utente decide
 *   2. PREPARE — prepara draft, utente approva
 *   3. EXECUTE — esegue, utente può annullare (con finestra)
 *   4. AUTOPILOT — esegue senza intervento
 *
 * Il livello dipende da: stato partner, confidence score, storico errori, preferenze utente.
 */

// Re-export all public APIs from the modular structure
export type {
  SupabaseClient,
  AutonomyLevel,
  ActionType,
  NextAction,
  PartnerState,
  DecisionContext,
} from "./decisionEngine/index.ts";

export {
  resolveAutonomy,
  decideNextActions,
  evaluatePartner,
} from "./decisionEngine/index.ts";
