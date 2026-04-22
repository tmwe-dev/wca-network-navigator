/**
 * decisionEngine/decider.ts — Main decision orchestrator.
 *
 * Implements the decision matrix: given partner state, returns recommended actions.
 * Routes to specific rule sets based on lead status.
 */

import { DecisionContext, NextAction, PartnerState } from "./types.ts";
import {
  decideNew,
  decideFirstTouchSent,
  decideHolding,
  decideEngaged,
  decideQualified,
  decideNegotiation,
  decideConverted,
  decideArchived,
  decideBlacklisted,
} from "./rules.ts";

/**
 * Matrice decisionale: dato lo stato, restituisce le azioni raccomandate.
 *
 * Routes to appropriate decision rule based on partner's lead status.
 *
 * @param state - Current partner state
 * @param ctx - Decision context (user preferences, error rates)
 * @returns Array of recommended next actions
 */
export function decideNextActions(
  state: PartnerState,
  ctx: DecisionContext,
): NextAction[] {
  const actions: NextAction[] = [];
  const s = state;

  switch (s.leadStatus) {
    // ═══ NEW — mai contattato ═══
    case "new":
      actions.push(...decideNew(state, ctx));
      break;

    // ═══ FIRST_TOUCH_SENT — aspettando risposta primo contatto ═══
    case "first_touch_sent":
      actions.push(...decideFirstTouchSent(state, ctx));
      break;

    // ═══ HOLDING — silenzio prolungato ═══
    case "holding":
      actions.push(...decideHolding(state, ctx));
      break;

    // ═══ ENGAGED — conversazione attiva ═══
    case "engaged":
      actions.push(...decideEngaged(state, ctx));
      break;

    // ═══ QUALIFIED — pronto per decisione ═══
    case "qualified":
      actions.push(...decideQualified(state, ctx));
      break;

    // ═══ NEGOTIATION — trattativa ═══
    case "negotiation":
      actions.push(...decideNegotiation(state, ctx));
      break;

    // ═══ CONVERTED — cliente attivo ═══
    case "converted":
      actions.push(...decideConverted(state, ctx));
      break;

    // ═══ ARCHIVED — inattivo ═══
    case "archived":
      actions.push(...decideArchived(state, ctx));
      break;

    // ═══ BLACKLISTED — nessuna azione ═══
    case "blacklisted":
      actions.push(...decideBlacklisted(state, ctx));
      break;
  }

  // === AZIONE GARANTITA: se nessuna azione, suggerisci no_action ===
  if (actions.length === 0) {
    actions.push({
      action: "no_action",
      autonomy: "suggest",
      due_in_days: 0,
      reasoning: `Stato "${s.leadStatus}" — nessuna azione automatica necessaria al momento`,
      priority: 5,
    });
  }

  return actions;
}
