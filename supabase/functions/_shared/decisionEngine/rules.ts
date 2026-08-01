/**
 * decisionEngine/rules.ts — Decision rules for each lead status.
 *
 * Implements the state machine logic that determines which actions
 * to recommend based on partner state and lead status.
 */

import { DecisionContext, NextAction, PartnerState } from "./types.ts";
import { resolveAutonomy } from "./autonomy.ts";

/**
 * Regole decisioni per status NEW
 */
export function decideNew(
  state: PartnerState,
  ctx: DecisionContext,
): NextAction[] {
  const actions: NextAction[] = [];
  const s = state;

  if (s.enrichmentScore < 40) {
    actions.push({
      action: "deep_search",
      autonomy: resolveAutonomy("execute", ctx),
      due_in_days: 0,
      reasoning: "Partner nuovo con dati insufficienti — arricchimento prima del contatto",
      priority: 3,
      context: { suggested_level: 1 },
    });
  } else if (s.enrichmentScore < 25) {
    // Oracle auto-escalation: deep search level 3 for very low scores
    actions.push({
      action: "deep_search",
      autonomy: resolveAutonomy("execute", ctx),
      due_in_days: 0,
      reasoning: "Score arricchimento critico (< 25) — escalazione a Sherlock Level 3",
      priority: 2,
      context: { suggested_level: 3, escalation_reason: "critical_data_gap" },
    });
  }
  actions.push({
    action: "send_email",
    autonomy: resolveAutonomy("prepare", ctx),
    channel: "email",
    due_in_days: s.enrichmentScore >= 40 ? 0 : 1,
    journalist_role: "rompighiaccio",
    reasoning: "Primo contatto email — il Rompighiaccio apre il dialogo",
    priority: 3,
  });

  return actions;
}

/**
 * Regole decisioni per status FIRST_TOUCH_SENT
 */
export function decideFirstTouchSent(
  state: PartnerState,
  ctx: DecisionContext,
): NextAction[] {
  const actions: NextAction[] = [];
  const s = state;

  // Oracle escalation for low enrichment during first touch sequence
  if (s.enrichmentScore < 40 && s.daysSinceLastOutbound >= 5) {
    actions.push({
      action: "deep_search",
      autonomy: resolveAutonomy("suggest", ctx),
      due_in_days: 0,
      reasoning: `Sequenza primo contatto in corso ma dati insufficienti (${Math.round(s.enrichmentScore)}%) — escalazione Level 2 per contesto migliore`,
      priority: 3,
      context: { suggested_level: 2, escalation_reason: "low_enrichment_during_sequence" },
    });
  }

  if (s.daysSinceLastOutbound >= 3 && s.daysSinceLastOutbound < 7) {
    actions.push({
      action: "send_linkedin",
      autonomy: resolveAutonomy("prepare", ctx),
      channel: "linkedin",
      due_in_days: 0,
      journalist_role: "rompighiaccio",
      reasoning: `${s.daysSinceLastOutbound}gg dal primo contatto — LinkedIn connection (sequenza G3)`,
      priority: 3,
    });
  } else if (s.daysSinceLastOutbound >= 7 && s.daysSinceLastOutbound < 12) {
    actions.push({
      action: "send_email",
      autonomy: resolveAutonomy("prepare", ctx),
      channel: "email",
      due_in_days: 0,
      journalist_role: "rompighiaccio",
      reasoning: `${s.daysSinceLastOutbound}gg senza risposta — follow-up email (sequenza G7-G8)`,
      priority: 3,
    });
  } else if (s.daysSinceLastOutbound >= 23) {
    actions.push({
      action: "update_status",
      autonomy: resolveAutonomy("execute", ctx),
      due_in_days: 0,
      reasoning: "Sequenza primo contatto completata senza risposta → holding",
      priority: 4,
      context: { new_status: "holding" },
    });
  }

  return actions;
}

/**
 * Regole decisioni per status HOLDING
 */
export function decideHolding(
  state: PartnerState,
  ctx: DecisionContext,
): NextAction[] {
  const actions: NextAction[] = [];
  const s = state;

  // Oracle escalation for holding with low enrichment
  if (s.enrichmentScore < 40 && s.daysSinceLastOutbound >= 15) {
    actions.push({
      action: "deep_search",
      autonomy: resolveAutonomy("suggest", ctx),
      due_in_days: 0,
      reasoning: `In holding con dati insufficienti (${Math.round(s.enrichmentScore)}%) — escalazione Level 2 per nuovo angolo`,
      priority: 3,
      context: { suggested_level: 2, escalation_reason: "enrichment_refresh_during_holding" },
    });
  }
  if (s.enrichmentScore < 25) {
    // Critical enrichment gap
    actions.push({
      action: "deep_search",
      autonomy: resolveAutonomy("suggest", ctx),
      due_in_days: 0,
      reasoning: `Holding con score critico (< 25) — escalazione Level 3 per massimo contesto`,
      priority: 2,
      context: { suggested_level: 3, escalation_reason: "critical_enrichment_gap_holding" },
    });
  }

  if (s.daysSinceLastOutbound >= 30 && s.touchCount < 6) {
    actions.push({
      action: "send_email",
      autonomy: resolveAutonomy("prepare", ctx),
      channel: "email",
      due_in_days: 0,
      journalist_role: "risvegliatore",
      reasoning: `In holding da ${s.daysSinceLastOutbound}gg (${s.touchCount} touch) — il Risvegliatore offre nuova prospettiva`,
      priority: 4,
    });
  } else if (s.touchCount >= 6 && s.daysSinceLastOutbound >= 60) {
    actions.push({
      action: "archive",
      autonomy: resolveAutonomy("suggest", ctx),
      due_in_days: 0,
      reasoning: `${s.touchCount} tentativi senza risposta in 60+ gg — valuta archiviazione`,
      priority: 5,
    });
  }

  return actions;
}

/**
 * Regole decisioni per status ENGAGED
 */
export function decideEngaged(
  state: PartnerState,
  ctx: DecisionContext,
): NextAction[] {
  const actions: NextAction[] = [];
  const s = state;

  if (s.daysSinceLastInbound !== null && s.daysSinceLastInbound <= 3) {
    // Risposta recente → accompagna
    if (!s.hasActiveReminder) {
      actions.push({
        action: "send_email",
        autonomy: resolveAutonomy("prepare", ctx),
        channel: "email",
        due_in_days: 1,
        journalist_role: "accompagnatore",
        reasoning: "Risposta ricevuta di recente — l'Accompagnatore propone prossimo passo",
        priority: 2,
      });
    }
  } else if (s.daysSinceLastInbound !== null && s.daysSinceLastInbound > 5) {
    // Silenzio dopo engagement
    actions.push({
      action: "send_email",
      autonomy: resolveAutonomy("prepare", ctx),
      channel: "email",
      due_in_days: 0,
      journalist_role: "risvegliatore",
      reasoning: `Engaged ma silenzio da ${s.daysSinceLastInbound}gg — Risvegliatore`,
      priority: 3,
    });
  }

  return actions;
}

/**
 * Regole decisioni per status QUALIFIED
 */
export function decideQualified(
  state: PartnerState,
  ctx: DecisionContext,
): NextAction[] {
  const actions: NextAction[] = [];
  const s = state;

  if (!s.hasActiveReminder) {
    actions.push({
      action: "prepare_proposal",
      autonomy: resolveAutonomy("prepare", ctx),
      due_in_days: 0,
      journalist_role: "chiusore",
      reasoning: "Partner qualificato — prepara proposta per chiusura",
      priority: 2,
    });
  }
  if (s.daysSinceLastOutbound >= 5) {
    actions.push({
      action: "send_email",
      autonomy: resolveAutonomy("prepare", ctx),
      channel: "email",
      due_in_days: 0,
      journalist_role: "chiusore",
      reasoning: `Qualificato da ${s.daysSinceLastOutbound}gg senza azione — il Chiusore porta a decisione`,
      priority: 2,
    });
  }

  return actions;
}

/**
 * Regole decisioni per status NEGOTIATION
 */
export function decideNegotiation(
  state: PartnerState,
  ctx: DecisionContext,
): NextAction[] {
  const actions: NextAction[] = [];
  const s = state;

  if (s.daysSinceLastOutbound >= 2 && !s.hasActiveReminder) {
    actions.push({
      action: "send_email",
      autonomy: resolveAutonomy("suggest", ctx),
      channel: "email",
      due_in_days: 0,
      journalist_role: "chiusore",
      reasoning: "In negoziazione — follow-up rapido (T+2) per mantenere momentum",
      priority: 1,
    });
  }

  return actions;
}

/**
 * Regole decisioni per status CONVERTED
 */
export function decideConverted(
  state: PartnerState,
  ctx: DecisionContext,
): NextAction[] {
  const actions: NextAction[] = [];
  const s = state;

  if (s.daysSinceLastOutbound >= 14 && !s.hasActiveReminder) {
    actions.push({
      action: "send_email",
      autonomy: resolveAutonomy("prepare", ctx),
      channel: "email",
      due_in_days: 0,
      journalist_role: "accompagnatore",
      reasoning: "Partner convertito — check-in periodico (T+14) per nurturing",
      priority: 4,
    });
  }

  return actions;
}

/**
 * Regole decisioni per status ARCHIVED
 */
export function decideArchived(
  state: PartnerState,
  ctx: DecisionContext,
): NextAction[] {
  const actions: NextAction[] = [];
  const s = state;

  if (s.daysSinceLastOutbound >= 90) {
    actions.push({
      action: "send_email",
      autonomy: resolveAutonomy("suggest", ctx),
      channel: "email",
      due_in_days: 0,
      journalist_role: "risvegliatore",
      reasoning: "Archiviato da 90+ gg — il Risvegliatore propone nuova prospettiva (re-engagement)",
      priority: 5,
    });
  }

  return actions;
}

/**
 * Regole decisioni per status BLACKLISTED
 */
export function decideBlacklisted(
  _state: PartnerState,
  _ctx: DecisionContext,
): NextAction[] {
  return [
    {
      action: "no_action",
      autonomy: "suggest",
      due_in_days: 0,
      reasoning: "Partner in blacklist — nessuna comunicazione permessa",
      priority: 5,
    },
  ];
}
