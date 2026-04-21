/**
 * decisionEngine.ts — Matrice decisionale + autonomia (LOVABLE-89).
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

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

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

/**
 * Matrice decisionale: dato lo stato, restituisce le azioni raccomandate.
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
      break;

    // ═══ FIRST_TOUCH_SENT — aspettando risposta primo contatto ═══
    case "first_touch_sent":
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
      break;

    // ═══ HOLDING — silenzio prolungato ═══
    case "holding":
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
      break;

    // ═══ ENGAGED — conversazione attiva ═══
    case "engaged":
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
      break;

    // ═══ QUALIFIED — pronto per decisione ═══
    case "qualified":
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
      break;

    // ═══ NEGOTIATION — trattativa ═══
    case "negotiation":
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
      break;

    // ═══ CONVERTED — cliente attivo ═══
    case "converted":
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
      break;

    // ═══ ARCHIVED — inattivo ═══
    case "archived":
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
      break;

    // ═══ BLACKLISTED — nessuna azione ═══
    case "blacklisted":
      actions.push({
        action: "no_action",
        autonomy: "suggest",
        due_in_days: 0,
        reasoning: "Partner in blacklist — nessuna comunicazione permessa",
        priority: 5,
      });
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

/**
 * Risolve il livello di autonomia effettivo.
 * Degrada verso "suggest" se: error rate alto, utente preferisce controllo.
 */
function resolveAutonomy(
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

/**
 * Carica lo stato di un partner e calcola le next actions.
 * Funzione di convenienza one-shot.
 */
export async function evaluatePartner(
  supabase: SupabaseClient,
  partnerId: string,
  userId: string,
  userAutonomy?: AutonomyLevel,
): Promise<{ state: PartnerState; actions: NextAction[] }> {
  // Carica partner
  const { data: partner } = await supabase
    .from("partners")
    .select("lead_status, email, enrichment_data")
    .eq("id", partnerId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!partner) {
    return {
      state: {
        partnerId,
        leadStatus: "new",
        touchCount: 0,
        daysSinceLastOutbound: 999,
        daysSinceLastInbound: null,
        lastOutcome: null,
        hasActiveReminder: false,
        enrichmentScore: 0,
        hasInboundWhatsApp: false,
        isWhitelisted: false,
      },
      actions: [{
        action: "no_action",
        autonomy: "suggest",
        due_in_days: 0,
        reasoning: "Partner non trovato",
        priority: 5,
      }],
    };
  }

  // Conta interazioni
  const { count: touchCount } = await supabase
    .from("activities")
    .select("id", { count: "exact", head: true })
    .eq("partner_id", partnerId)
    .eq("user_id", userId)
    .in("activity_type", ["send_email", "whatsapp_message", "linkedin_message"]);

  // Ultimo outbound
  const { data: lastOutbound } = await supabase
    .from("activities")
    .select("created_at")
    .eq("partner_id", partnerId)
    .eq("user_id", userId)
    .in("activity_type", ["send_email", "whatsapp_message", "linkedin_message"])
    .order("created_at", { ascending: false })
    .limit(1);

  const daysSinceLastOutbound = lastOutbound?.[0]?.created_at
    ? Math.floor((Date.now() - new Date(lastOutbound[0].created_at).getTime()) / 86400000)
    : 999;

  // Ultimo inbound
  const { data: lastInbound } = await supabase
    .from("email_classifications")
    .select("classified_at, category")
    .eq("partner_id", partnerId)
    .eq("user_id", userId)
    .order("classified_at", { ascending: false })
    .limit(1);

  const daysSinceLastInbound = lastInbound?.[0]?.classified_at
    ? Math.floor((Date.now() - new Date(lastInbound[0].classified_at).getTime()) / 86400000)
    : null;

  // Reminder attivi
  const { count: activeReminders } = await supabase
    .from("activities")
    .select("id", { count: "exact", head: true })
    .eq("partner_id", partnerId)
    .eq("user_id", userId)
    .eq("status", "pending")
    .eq("activity_type", "follow_up");

  // Enrichment score
  let enrichmentScore = 0;
  try {
    const { getPartnerDeepSearchScore } = await import("./deepSearchScore.ts");
    const dsResult = await getPartnerDeepSearchScore(supabase, partnerId, userId);
    enrichmentScore = dsResult.score;
  } catch {
    enrichmentScore = 0;
  }

  // Error rate recente
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const { count: totalActions } = await supabase
    .from("ai_pending_actions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", thirtyDaysAgo);
  const { count: failedActions } = await supabase
    .from("ai_pending_actions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "failed")
    .gte("created_at", thirtyDaysAgo);
  const errorRate = (totalActions ?? 0) > 0 ? (failedActions ?? 0) / (totalActions ?? 1) : 0;

  // Autonomia utente
  let userPref: AutonomyLevel = userAutonomy || "prepare";
  if (!userAutonomy) {
    const { data: prefSetting } = await supabase
      .from("app_settings")
      .select("value")
      .eq("user_id", userId)
      .eq("key", "decision_engine_autonomy")
      .maybeSingle();
    if (prefSetting?.value && ["suggest", "prepare", "execute", "autopilot"].includes(prefSetting.value)) {
      userPref = prefSetting.value as AutonomyLevel;
    }
  }

  const state: PartnerState = {
    partnerId,
    leadStatus: partner.lead_status || "new",
    touchCount: touchCount ?? 0,
    daysSinceLastOutbound,
    daysSinceLastInbound,
    lastOutcome: lastInbound?.[0]?.category || null,
    hasActiveReminder: (activeReminders ?? 0) > 0,
    enrichmentScore,
    hasInboundWhatsApp: false,
    isWhitelisted: false,
  };

  const actions = decideNextActions(state, {
    userId,
    userAutonomyPreference: userPref,
    globalErrorRate: errorRate,
  });

  return { state, actions };
}
