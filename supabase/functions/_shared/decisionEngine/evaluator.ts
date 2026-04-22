/**
 * decisionEngine/evaluator.ts — Partner state loading and evaluation.
 *
 * Loads partner data from Supabase and enriches it to create PartnerState,
 * then calculates recommended next actions. One-shot evaluation convenience function.
 */

import {
  AutonomyLevel,
  DecisionContext,
  NextAction,
  PartnerState,
  SupabaseClient,
} from "./types.ts";
import { decideNextActions } from "./decider.ts";

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

  const actions = decideNextActions(state, {
    userId,
    userAutonomyPreference: userPref,
    globalErrorRate: errorRate,
  });

  return { state, actions };
}
