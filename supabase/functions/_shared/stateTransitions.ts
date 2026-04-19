/**
 * stateTransitions.ts — Gate automatici per la transizione tra stati commerciali.
 *
 * TASSONOMIA STATI (canonica, allineata al DB partners.lead_status):
 *   new | first_touch_sent | holding | engaged | qualified | negotiation | converted | archived | blacklisted
 *
 * Gate canonici (Costituzione Commerciale §2):
 *   new → first_touch_sent (auto: primo messaggio inviato)
 *   first_touch_sent → holding (auto: 3gg senza risposta)
 *   first_touch_sent → engaged (auto: risposta ricevuta)
 *   holding → engaged (auto: risposta ricevuta)
 *   holding → archived (manuale: 3+ tentativi, 90+gg, ragione valida)
 *   engaged → qualified (manuale: bisogno esplicito)
 *   qualified → negotiation (manuale: proposta inviata)
 *   negotiation → converted (manuale: evidenza contratto/ordine)
 *   * → archived (manuale: con exit_reason valido)
 *   * → blacklisted (manuale: GDPR/frode/abuso)
 *
 * NOTA: il trigger DB sync_bca_lead_status_to_partner consente solo escalation
 * monotona (new<first_touch_sent<holding<engaged<qualified<negotiation<converted).
 * archived/blacklisted sono terminali e si applicano solo manualmente.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

type SupabaseClient = ReturnType<typeof createClient>;

export interface TransitionGate {
  from: string;
  to: string;
  trigger: string;
  autoApply: boolean;
}

// ── Gate di transizione canonici (9 stati) ──
export const TRANSITION_GATES: TransitionGate[] = [
  { from: "new", to: "first_touch_sent", trigger: "Primo messaggio inviato", autoApply: true },
  { from: "first_touch_sent", to: "holding", trigger: "3gg senza risposta", autoApply: true },
  { from: "first_touch_sent", to: "engaged", trigger: "Risposta ricevuta", autoApply: true },
  { from: "holding", to: "engaged", trigger: "Risposta ricevuta", autoApply: true },
  { from: "holding", to: "archived", trigger: "3+ tentativi, 90+gg, ragione valida", autoApply: false },
  { from: "engaged", to: "qualified", trigger: "Bisogno esplicito identificato", autoApply: false },
  { from: "qualified", to: "negotiation", trigger: "Proposta inviata", autoApply: false },
  { from: "negotiation", to: "converted", trigger: "Contratto/ordine confermato", autoApply: false },
  { from: "*", to: "archived", trigger: "Exit reason valido", autoApply: false },
  { from: "*", to: "blacklisted", trigger: "GDPR/frode/abuso", autoApply: false },
];

const STATE_ORDER: Record<string, number> = {
  new: 0,
  first_touch_sent: 1,
  holding: 2,
  engaged: 3,
  qualified: 4,
  negotiation: 5,
  converted: 6,
};

export function isValidTransition(from: string, to: string): boolean {
  if (to === "archived" || to === "blacklisted") return true; // sempre consentiti (manuali)
  if (from === to) return false;
  const oFrom = STATE_ORDER[from] ?? -1;
  const oTo = STATE_ORDER[to] ?? -1;
  if (oFrom < 0 || oTo < 0) return false;
  return oTo > oFrom; // solo escalation monotona
}

export interface TransitionResult {
  shouldTransition: boolean;
  from: string;
  to: string;
  trigger: string;
  autoApply: boolean;
}

export async function evaluateTransitions(
  supabase: SupabaseClient,
  partnerId: string,
  userId: string,
): Promise<TransitionResult[]> {
  const { data: partner } = await supabase
    .from("partners")
    .select("lead_status, last_interaction_at, interaction_count")
    .eq("id", partnerId)
    .eq("user_id", userId)
    .single();

  if (!partner) return [];

  const currentState = ((partner.lead_status as string) || "new").toLowerCase();
  const lastInteractionAt = partner.last_interaction_at as string | null;
  const daysSinceLastInteraction = lastInteractionAt
    ? Math.floor((Date.now() - new Date(lastInteractionAt).getTime()) / 86400000)
    : 999;

  const results: TransitionResult[] = [];

  // Inbound recente?
  const { data: recentInbound } = await supabase
    .from("channel_messages")
    .select("id, created_at")
    .eq("user_id", userId)
    .eq("partner_id", partnerId)
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .limit(1);

  const hasRecentInbound = !!(recentInbound && recentInbound.length > 0);

  // Outbound count (azioni completate)
  const { count: outboundCount } = await supabase
    .from("activities")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("source_id", partnerId)
    .eq("status", "completed");

  // ── Gate ──

  // new → first_touch_sent (auto): primo messaggio inviato
  if (currentState === "new" && (outboundCount || 0) > 0) {
    results.push({
      shouldTransition: true,
      from: "new", to: "first_touch_sent",
      trigger: "Primo messaggio inviato",
      autoApply: true,
    });
  }

  // first_touch_sent → engaged (auto): risposta ricevuta
  if (currentState === "first_touch_sent" && hasRecentInbound) {
    results.push({
      shouldTransition: true,
      from: "first_touch_sent", to: "engaged",
      trigger: "Risposta ricevuta",
      autoApply: true,
    });
  }

  // first_touch_sent → holding (auto): 3+ giorni senza risposta
  if (currentState === "first_touch_sent" && daysSinceLastInteraction >= 3 && !hasRecentInbound) {
    results.push({
      shouldTransition: true,
      from: "first_touch_sent", to: "holding",
      trigger: `${daysSinceLastInteraction}gg senza risposta`,
      autoApply: true,
    });
  }

  // holding → engaged (auto): risposta ricevuta
  if (currentState === "holding" && hasRecentInbound) {
    results.push({
      shouldTransition: true,
      from: "holding", to: "engaged",
      trigger: "Risposta ricevuta dopo holding",
      autoApply: true,
    });
  }

  // holding → archived (proposto): 90+ giorni + 3+ tentativi
  if (currentState === "holding" && daysSinceLastInteraction >= 90 && (outboundCount || 0) >= 3) {
    results.push({
      shouldTransition: true,
      from: "holding", to: "archived",
      trigger: `${daysSinceLastInteraction}gg, ${outboundCount} tentativi — richiede approvazione Director`,
      autoApply: false,
    });
  }

  return results;
}

// ── Applica una transizione ──
export async function applyTransition(
  supabase: SupabaseClient,
  partnerId: string,
  userId: string,
  transition: TransitionResult,
): Promise<boolean> {
  if (!isValidTransition(transition.from, transition.to)) {
    console.warn("[StateTransition] BLOCKED invalid transition:", JSON.stringify(transition));
    return false;
  }

  const { error } = await supabase
    .from("partners")
    .update({ lead_status: transition.to })
    .eq("id", partnerId)
    .eq("user_id", userId);

  if (error) {
    console.error("[StateTransition] Failed to apply:", JSON.stringify({
      partner_id: partnerId, from: transition.from, to: transition.to, error: error.message,
    }));
    return false;
  }

  // Log transizione come activity
  const { error: logError } = await supabase.from("activities").insert({
    user_id: userId,
    source_id: partnerId,
    source_type: "partner",
    activity_type: "other",
    title: `Stato: ${transition.from} → ${transition.to}`,
    description: `Transizione. Trigger: ${transition.trigger}. ${transition.autoApply ? "Auto-applicata." : "Approvata manualmente."}`,
    status: "completed",
  });

  if (logError) console.warn("[StateTransition] Log activity failed:", logError.message);

  console.log("[StateTransition] APPLIED", JSON.stringify({
    partner_id: partnerId, from: transition.from, to: transition.to, trigger: transition.trigger,
  }));
  return true;
}
