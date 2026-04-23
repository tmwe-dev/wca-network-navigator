/**
 * decisionEngine/evaluator.ts — Unified partner evaluation.
 *
 * FIX 2: Single entry point that orchestrates:
 *   1. stateTransitions — auto-apply pending state changes
 *   2. decider — recommend next actions based on current state
 *   3. cadenceEngine — filter/annotate actions with timing constraints
 *
 * Callers only need `evaluatePartner()`. No more conflicting decisions.
 */

import {
  AutonomyLevel,
  DecisionContext,
  NextAction,
  PartnerState,
  SupabaseClient,
} from "./types.ts";
import { decideNextActions } from "./decider.ts";
import { evaluateTransitions, applyTransition } from "../stateTransitions.ts";
import { checkCadence, type CadenceCheckResult } from "../cadenceEngine.ts";
import { LeadProcessManager } from "../processManagers/leadProcessManager.ts";

/**
 * Carica lo stato di un partner e calcola le next actions.
 * Funzione di convenienza one-shot.
 *
 * @param supabase - Supabase client
 * @param partnerId - ID of the partner to evaluate
 * @param userId - ID of the user (owner)
 * @param userAutonomy - Optional override for user's autonomy preference
 * @returns Partner state and recommended actions
 */
/** Extended result with cadence + transition metadata */
export interface EvaluatePartnerResult {
  state: PartnerState;
  actions: NextAction[];
  /** State transitions that were auto-applied (FIX 2) */
  appliedTransitions: Array<{ from: string; to: string; trigger: string }>;
  /** Cadence constraints applied to each action (FIX 2) */
  cadenceAnnotations: Array<{ action: string; channel?: string; cadence: CadenceCheckResult }>;
}

export async function evaluatePartner(
  supabase: SupabaseClient,
  partnerId: string,
  userId: string,
  userAutonomy?: AutonomyLevel,
): Promise<EvaluatePartnerResult> {
  // ── Phase 0: State Transitions via LeadProcessManager ──
  const appliedTransitions: EvaluatePartnerResult["appliedTransitions"] = [];
  try {
    const leadPM = new LeadProcessManager(supabase);
    const pmResults = await leadPM.evaluateTimeBasedTransitions(partnerId, userId);
    for (const r of pmResults) {
      if (r.applied) {
        appliedTransitions.push({ from: r.from, to: r.to, trigger: r.trigger });
      }
    }
  } catch (e) {
    console.warn("[evaluatePartner] LeadProcessManager failed (non-blocking):", e);
  }

  // ── Phase 1: Load partner (re-read after transitions may have changed lead_status) ──
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
      appliedTransitions,
      cadenceAnnotations: [],
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
    if (
      prefSetting?.value &&
      ["suggest", "prepare", "execute", "autopilot"].includes(prefSetting.value)
    ) {
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

  // ── Phase 2: Decide next actions ──
  const rawActions = decideNextActions(state, {
    userId,
    userAutonomyPreference: userPref,
    globalErrorRate: errorRate,
  });

  // ── Phase 3: Filter through cadence engine — reconcile conflicts ──
  const cadenceAnnotations: EvaluatePartnerResult["cadenceAnnotations"] = [];
  const lastContactDate = lastOutbound?.[0]?.created_at || null;

  // Count touches this week for cadence check
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const { count: touchesThisWeek } = await supabase
    .from("activities")
    .select("id", { count: "exact", head: true })
    .eq("partner_id", partnerId)
    .eq("user_id", userId)
    .in("activity_type", ["send_email", "whatsapp_message", "linkedin_message"])
    .gte("created_at", weekAgo);

  // Last channel used
  const lastChannel = lastOutbound?.[0]
    ? (await supabase
        .from("activities")
        .select("activity_type")
        .eq("partner_id", partnerId)
        .eq("user_id", userId)
        .in("activity_type", ["send_email", "whatsapp_message", "linkedin_message"])
        .order("created_at", { ascending: false })
        .limit(1)
      ).data?.[0]?.activity_type ?? null
    : null;

  const channelMap: Record<string, "email" | "linkedin" | "whatsapp"> = {
    send_email: "email", whatsapp_message: "whatsapp", linkedin_message: "linkedin",
  };

  const actions: NextAction[] = [];
  for (const action of rawActions) {
    const channel = action.channel;
    if (channel) {
      const cadenceResult = checkCadence(
        state.leadStatus,
        lastContactDate,
        lastChannel ? (channelMap[lastChannel] || lastChannel) : null,
        touchesThisWeek ?? 0,
        channel,
        state.hasInboundWhatsApp || state.isWhitelisted,
      );
      cadenceAnnotations.push({ action: action.action, channel, cadence: cadenceResult });
      if (!cadenceResult.allowed) {
        // Cadence blocks this action — downgrade to suggestion with reason
        actions.push({
          ...action,
          autonomy: "suggest",
          reasoning: `${action.reasoning} [CADENZA BLOCCA: ${cadenceResult.reason}]`,
          // If cadence suggests alternative channel, note it
          channel: cadenceResult.suggestedChannel || channel,
          context: {
            ...action.context,
            cadence_blocked: true,
            cadence_reason: cadenceResult.reason,
            next_allowed_date: cadenceResult.nextAllowedDate,
          },
        });
      } else {
        // Cadence allows — pass through with optional channel suggestion
        if (cadenceResult.suggestedChannel && cadenceResult.suggestedChannel !== channel) {
          actions.push({
            ...action,
            context: {
              ...action.context,
              cadence_suggested_channel: cadenceResult.suggestedChannel,
            },
          });
        } else {
          actions.push(action);
        }
      }
    } else {
      // Non-channel actions (deep_search, archive, etc.) pass through
      actions.push(action);
    }
  }

  return { state, actions, appliedTransitions, cadenceAnnotations };
}
