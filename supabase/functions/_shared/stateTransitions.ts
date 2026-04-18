/**
 * stateTransitions.ts — Gate automatici per la transizione tra stati commerciali.
 * Definisce QUANDO un contatto passa da uno stato all'altro.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

type SupabaseClient = ReturnType<typeof createClient>;

export interface TransitionGate {
  from: string;
  to: string;
  trigger: string; // descrizione leggibile
  autoApply: boolean; // true = transizione automatica, false = proposta all'utente
}

// ── Definizione gate di transizione ──
export const TRANSITION_GATES: TransitionGate[] = [
  // new → first_touch_sent
  {
    from: "new",
    to: "first_touch_sent",
    trigger: "Primo messaggio inviato (email o LinkedIn)",
    autoApply: true,
  },
  // first_touch_sent → holding (nessuna risposta dopo 14 giorni)
  {
    from: "first_touch_sent",
    to: "holding",
    trigger: "14 giorni senza risposta dopo il primo contatto",
    autoApply: true,
  },
  // first_touch_sent → engaged (il contatto risponde)
  {
    from: "first_touch_sent",
    to: "engaged",
    trigger: "Il contatto ha risposto al messaggio",
    autoApply: true,
  },
  // holding → engaged (il contatto risponde a un nurturing)
  {
    from: "holding",
    to: "engaged",
    trigger: "Risposta ricevuta durante fase nurturing",
    autoApply: true,
  },
  // engaged → qualified (3+ scambi bidirezionali O interesse esplicito)
  {
    from: "engaged",
    to: "qualified",
    trigger: "3+ scambi bidirezionali completati OPPURE interesse commerciale esplicito",
    autoApply: false, // proposto all'utente
  },
  // qualified → negotiation (proposta/quotazione inviata)
  {
    from: "qualified",
    to: "negotiation",
    trigger: "Proposta commerciale o quotazione inviata",
    autoApply: false,
  },
  // negotiation → converted (deal chiuso)
  {
    from: "negotiation",
    to: "converted",
    trigger: "Deal confermato, primo ordine ricevuto",
    autoApply: false,
  },
  // any → holding (stale: nessun contatto per 30+ giorni)
  {
    from: "*",
    to: "holding",
    trigger: "30+ giorni senza alcuna interazione (inbound o outbound)",
    autoApply: true,
  },
  // holding → archived (90+ giorni in holding senza contatto)
  {
    from: "holding",
    to: "archived",
    trigger: "90+ giorni in holding senza alcuna risposta",
    autoApply: false,
  },
];

// ── Valuta transizioni automatiche per un partner ──
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
  // Load partner current state
  const { data: partner } = await supabase
    .from("partners")
    .select("lead_status, last_interaction_at, interaction_count")
    .eq("id", partnerId)
    .eq("user_id", userId)
    .single();

  if (!partner) return [];

  const currentState = (partner.lead_status as string) || "new";
  const lastInteractionAt = partner.last_interaction_at as string | null;
  const daysSinceLastInteraction = lastInteractionAt
    ? Math.floor((Date.now() - new Date(lastInteractionAt).getTime()) / 86400000)
    : 999;

  const results: TransitionResult[] = [];

  // Check inbound messages (reply detection)
  const { data: recentInbound } = await supabase
    .from("channel_messages")
    .select("id, created_at")
    .eq("user_id", userId)
    .eq("partner_id", partnerId)
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .limit(1);

  const hasRecentInbound = !!(recentInbound && recentInbound.length > 0);
  const lastInboundDaysAgo = hasRecentInbound
    ? Math.floor((Date.now() - new Date((recentInbound![0] as { created_at: string }).created_at).getTime()) / 86400000)
    : 999;

  // Count bidirectional exchanges
  const { count: inboundCount } = await supabase
    .from("channel_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("partner_id", partnerId)
    .eq("direction", "inbound");

  const { count: outboundCount } = await supabase
    .from("activities")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("source_id", partnerId)
    .eq("status", "completed");

  const bidirectionalExchanges = Math.min(inboundCount || 0, outboundCount || 0);

  // ── Evaluate each gate ──

  // new → first_touch_sent
  if (currentState === "new" && (outboundCount || 0) > 0) {
    results.push({
      shouldTransition: true,
      from: "new", to: "first_touch_sent",
      trigger: "Primo messaggio inviato",
      autoApply: true,
    });
  }

  // first_touch_sent → engaged (reply received)
  if (currentState === "first_touch_sent" && hasRecentInbound) {
    results.push({
      shouldTransition: true,
      from: "first_touch_sent", to: "engaged",
      trigger: "Il contatto ha risposto",
      autoApply: true,
    });
  }

  // first_touch_sent → holding (14 days no reply)
  if (currentState === "first_touch_sent" && daysSinceLastInteraction >= 14 && !hasRecentInbound) {
    results.push({
      shouldTransition: true,
      from: "first_touch_sent", to: "holding",
      trigger: `${daysSinceLastInteraction} giorni senza risposta`,
      autoApply: true,
    });
  }

  // holding → engaged (reply during nurturing)
  if (currentState === "holding" && hasRecentInbound && lastInboundDaysAgo <= 7) {
    results.push({
      shouldTransition: true,
      from: "holding", to: "engaged",
      trigger: "Risposta ricevuta durante nurturing",
      autoApply: true,
    });
  }

  // engaged → qualified (3+ bidirectional exchanges)
  if (currentState === "engaged" && bidirectionalExchanges >= 3) {
    results.push({
      shouldTransition: true,
      from: "engaged", to: "qualified",
      trigger: `${bidirectionalExchanges} scambi bidirezionali`,
      autoApply: false, // proposto
    });
  }

  // Stale: any active state → holding if 30+ days no interaction
  if (["first_touch_sent", "engaged", "qualified"].includes(currentState) && daysSinceLastInteraction >= 30) {
    results.push({
      shouldTransition: true,
      from: currentState, to: "holding",
      trigger: `${daysSinceLastInteraction} giorni senza interazione`,
      autoApply: true,
    });
  }

  // holding → archived (90+ days)
  if (currentState === "holding" && daysSinceLastInteraction >= 90 && !hasRecentInbound) {
    results.push({
      shouldTransition: true,
      from: "holding", to: "archived",
      trigger: `${daysSinceLastInteraction} giorni in holding senza risposta`,
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
  const { error } = await supabase
    .from("partners")
    .update({ lead_status: transition.to })
    .eq("id", partnerId)
    .eq("user_id", userId);

  if (error) {
    console.error("[StateTransition] Failed to apply:", error.message);
    return false;
  }

  // Log the transition
  await supabase.from("activities").insert({
    user_id: userId,
    source_id: partnerId,
    source_type: "partner",
    activity_type: "state_transition",
    title: `Stato: ${transition.from} → ${transition.to}`,
    description: `Trigger: ${transition.trigger}. ${transition.autoApply ? "Applicato automaticamente." : "Proposto per approvazione."}`,
    status: "completed",
  });

  console.log(`[StateTransition] ${partnerId}: ${transition.from} → ${transition.to} (${transition.trigger})`);
  return true;
}
