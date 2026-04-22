/**
 * decisionEngine/types.ts — Type definitions for the decision engine.
 */

// deno-lint-ignore no-explicit-any
export type SupabaseClient = any;

export type AutonomyLevel = "suggest" | "prepare" | "execute" | "autopilot";

export type ActionType =
  | "send_email"
  | "send_whatsapp"
  | "send_linkedin"
  | "schedule_followup"
  | "deep_search"
  | "archive"
  | "escalate_to_human"
  | "prepare_proposal"
  | "update_status"
  | "no_action";

export interface NextAction {
  action: ActionType;
  autonomy: AutonomyLevel;
  /** Canale preferito se è un invio */
  channel?: "email" | "whatsapp" | "linkedin";
  /** Giorni dalla condizione (trigger timing) */
  due_in_days: number;
  /** Giornalista suggerito */
  journalist_role?: "rompighiaccio" | "risvegliatore" | "chiusore" | "accompagnatore";
  /** Reasoning per l'utente */
  reasoning: string;
  /** Priorità (1=critica, 5=bassa) */
  priority: 1 | 2 | 3 | 4 | 5;
  /** Contesto aggiuntivo per l'azione */
  context?: Record<string, unknown>;
}

export interface PartnerState {
  partnerId: string;
  leadStatus: string;
  touchCount: number;
  daysSinceLastOutbound: number;
  daysSinceLastInbound: number | null;
  lastOutcome: string | null;
  hasActiveReminder: boolean;
  enrichmentScore: number;
  hasInboundWhatsApp: boolean;
  isWhitelisted: boolean;
}

export interface DecisionContext {
  userId: string;
  userAutonomyPreference: AutonomyLevel;
  globalErrorRate: number; // % di errori recenti (0-1)
}
