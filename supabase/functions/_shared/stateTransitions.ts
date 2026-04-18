/**
 * stateTransitions.ts — Gate automatici per la transizione tra stati commerciali.
 *
 * TASSONOMIA STATI (canonica, allineata al DB partners.lead_status):
 *   new | contacted | in_progress | negotiation | converted | lost
 *
 * NOTA: il trigger DB sync_bca_lead_status_to_partner consente solo escalation
 * monotona (new<contacted<in_progress<negotiation<converted). Le transizioni
 * verso "lost" sono permesse solo via update diretto su partners (qui).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

type SupabaseClient = ReturnType<typeof createClient>;

export interface TransitionGate {
  from: string;
  to: string;
  trigger: string;
  autoApply: boolean;
}

// ── Gate di transizione (allineati alla tassonomia reale) ──
export const TRANSITION_GATES: TransitionGate[] = [
  { from: "new", to: "contacted", trigger: "Primo messaggio inviato (email o LinkedIn)", autoApply: true },
  { from: "contacted", to: "in_progress", trigger: "Il contatto ha risposto al messaggio", autoApply: true },
  { from: "contacted", to: "lost", trigger: "30+ giorni senza risposta dopo il primo contatto", autoApply: false },
  { from: "in_progress", to: "negotiation", trigger: "3+ scambi bidirezionali OPPURE proposta inviata", autoApply: false },
  { from: "negotiation", to: "converted", trigger: "Deal confermato, primo ordine ricevuto", autoApply: false },
  { from: "*", to: "lost", trigger: "60+ giorni senza alcuna interazione", autoApply: false },
];

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

  // Conteggi scambi bidirezionali
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

  // ── Gate ──

  // new → contacted (auto): primo messaggio inviato
  if (currentState === "new" && (outboundCount || 0) > 0) {
    results.push({
      shouldTransition: true,
      from: "new", to: "contacted",
      trigger: "Primo messaggio inviato",
      autoApply: true,
    });
  }

  // contacted → in_progress (auto): il contatto ha risposto
  if (currentState === "contacted" && hasRecentInbound) {
    results.push({
      shouldTransition: true,
      from: "contacted", to: "in_progress",
      trigger: "Il contatto ha risposto",
      autoApply: true,
    });
  }

  // contacted → lost (proposto): 30+ giorni senza risposta
  if (currentState === "contacted" && daysSinceLastInteraction >= 30 && !hasRecentInbound) {
    results.push({
      shouldTransition: true,
      from: "contacted", to: "lost",
      trigger: `${daysSinceLastInteraction} giorni senza risposta dopo primo contatto`,
      autoApply: false,
    });
  }

  // in_progress → negotiation (proposto): 3+ scambi bidirezionali
  if (currentState === "in_progress" && bidirectionalExchanges >= 3) {
    results.push({
      shouldTransition: true,
      from: "in_progress", to: "negotiation",
      trigger: `${bidirectionalExchanges} scambi bidirezionali`,
      autoApply: false,
    });
  }

  // Stale: in_progress/negotiation → lost se 60+ giorni senza interazione (proposto, non auto)
  if (["in_progress", "negotiation"].includes(currentState) && daysSinceLastInteraction >= 60) {
    results.push({
      shouldTransition: true,
      from: currentState, to: "lost",
      trigger: `${daysSinceLastInteraction} giorni senza interazione`,
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
    console.error("[StateTransition] Failed to apply:", JSON.stringify({
      partner_id: partnerId, from: transition.from, to: transition.to, error: error.message,
    }));
    return false;
  }

  // Log transizione come activity (usa activity_type valido: "other")
  const { error: logError } = await supabase.from("activities").insert({
    user_id: userId,
    source_id: partnerId,
    source_type: "partner",
    activity_type: "other",
    title: `Stato: ${transition.from} → ${transition.to}`,
    description: `Transizione automatica. Trigger: ${transition.trigger}. ${transition.autoApply ? "Applicato automaticamente." : "Proposto per approvazione."}`,
    status: "completed",
  });

  if (logError) {
    console.warn("[StateTransition] Log activity failed:", logError.message);
  }

  console.log("[StateTransition] APPLIED", JSON.stringify({
    partner_id: partnerId, from: transition.from, to: transition.to, trigger: transition.trigger,
  }));
  return true;
}
