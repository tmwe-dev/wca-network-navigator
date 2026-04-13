/**
 * cadence-engine — Cron-triggered engine for processing scheduled follow-up actions.
 * Runs hourly, checks trigger conditions, and creates/executes pending actions.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders, corsPreflight, getCorsHeaders } from "../_shared/cors.ts";
import { edgeError, extractErrorMessage } from "../_shared/handleEdgeError.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface CadenceRule {
  delay_days?: number;
  max_attempts?: number;
  sequence?: string[];
  current_step?: number;
  on_negative?: "slow_down" | "stop" | "escalate";
  auto_execute?: boolean;
}

interface ActionRow {
  id: string;
  mission_id: string | null;
  user_id: string;
  action_type: string;
  partner_id: string | null;
  contact_id: string | null;
  status: string;
  scheduled_at: string;
  cadence_rule: CadenceRule | null;
  trigger_condition: string | null;
  parent_action_id: string | null;
  position: number;
}

Deno.serve(async (req) => {
  const preflight = corsPreflight(req);
  if (preflight) return preflight;

  const headers = getCorsHeaders(req.headers.get("origin"));

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Fetch due actions
    const { data: actions, error: fetchErr } = await supabase
      .from("mission_actions")
      .select("id, mission_id, user_id, action_type, partner_id, contact_id, status, scheduled_at, cadence_rule, trigger_condition, parent_action_id, position")
      .lte("scheduled_at", new Date().toISOString())
      .not("scheduled_at", "is", null)
      .eq("status", "pending")
      .order("scheduled_at", { ascending: true })
      .limit(50);

    if (fetchErr) throw fetchErr;
    if (!actions?.length) {
      return new Response(JSON.stringify({ processed: 0, executed: 0, pending_review: 0, cancelled: 0 }), {
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    let executed = 0, pendingReview = 0, cancelled = 0;

    for (const action of actions as ActionRow[]) {
      try {
        await processAction(supabase, action, { executed: () => executed++, pendingReview: () => pendingReview++, cancelled: () => cancelled++ });
      } catch (e) {
        console.error(`[cadence-engine] Error processing action ${action.id}:`, extractErrorMessage(e));
      }
    }

    return new Response(JSON.stringify({
      processed: actions.length,
      executed,
      pending_review: pendingReview,
      cancelled,
    }), { headers: { ...headers, "Content-Type": "application/json" } });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[cadence-engine] Fatal:", msg, e);
    return edgeError("INTERNAL_ERROR", msg, undefined, headers);
  }
});

async function processAction(
  supabase: ReturnType<typeof createClient>,
  action: ActionRow,
  counters: { executed: () => void; pendingReview: () => void; cancelled: () => void },
) {
  // Extract target email — try partner contacts or use partner email
  let targetEmail: string | null = null;
  if (action.partner_id) {
    const { data: pc } = await supabase.from("partner_contacts").select("email").eq("partner_id", action.partner_id).limit(1).maybeSingle();
    targetEmail = pc?.email ?? null;
    if (!targetEmail) {
      const { data: p } = await supabase.from("partners").select("email").eq("id", action.partner_id).maybeSingle();
      targetEmail = p?.email ?? null;
    }
  }

  // Load conversation context
  let convCtx: any = null;
  if (targetEmail && action.user_id) {
    const { data } = await supabase
      .from("contact_conversation_context")
      .select("*")
      .eq("user_id", action.user_id)
      .eq("email_address", targetEmail)
      .maybeSingle();
    convCtx = data;
  }

  // Check trigger condition
  const trigger = action.trigger_condition || "immediate";
  const conditionMet = await checkTriggerCondition(supabase, trigger, action, targetEmail);

  if (!conditionMet.met) {
    // Handle based on what we found
    if (conditionMet.reason === "positive_response_received") {
      // Positive response → cancel follow-up
      await supabase.from("mission_actions").update({
        status: "completed",
        completed_at: new Date().toISOString(),
        last_error: "Risposta positiva ricevuta, follow-up non necessario",
      }).eq("id", action.id);
      counters.cancelled();
      return;
    }

    if (conditionMet.reason === "negative_response_received" && action.cadence_rule?.on_negative) {
      const onNeg = action.cadence_rule.on_negative;
      if (onNeg === "stop") {
        await supabase.from("mission_actions").update({
          status: "failed",
          completed_at: new Date().toISOString(),
          last_error: "Risposta negativa ricevuta, cadenza fermata",
        }).eq("id", action.id);
        counters.cancelled();
        return;
      }
      if (onNeg === "slow_down") {
        // Reschedule with doubled delay
        const delay = (action.cadence_rule.delay_days || 3) * 2;
        await supabase.from("mission_actions").update({
          scheduled_at: new Date(Date.now() + delay * 86400000).toISOString(),
          cadence_rule: { ...action.cadence_rule, delay_days: delay },
        }).eq("id", action.id);
        counters.cancelled();
        return;
      }
      // escalate → change channel, fall through to execution with modified type
    }

    // Condition not met but not a terminal state → skip for now (will be re-evaluated next hour)
    return;
  }

  // Condition IS met → create pending action or auto-execute

  // Check auto-execute rules
  let autoExecute = false;
  if (targetEmail && action.user_id) {
    const { data: rules } = await supabase
      .from("email_address_rules")
      .select("auto_execute, ai_confidence_threshold")
      .eq("user_id", action.user_id)
      .eq("email_address", targetEmail)
      .maybeSingle();

    if (rules?.auto_execute && action.cadence_rule?.auto_execute) {
      autoExecute = true;
    }
  }

  // Log decision
  const { data: decisionLog } = await supabase.from("ai_decision_log").insert({
    user_id: action.user_id,
    partner_id: action.partner_id,
    email_address: targetEmail,
    decision_type: "schedule_followup",
    input_context: {
      action_id: action.id,
      trigger_condition: trigger,
      cadence_rule: action.cadence_rule,
      conversation_summary: convCtx?.conversation_summary,
    },
    ai_reasoning: `Cadence trigger "${trigger}" met. Action type: ${action.action_type}.${autoExecute ? " Auto-executing." : " Queued for review."}`,
    confidence: 0.85,
    was_auto_executed: autoExecute,
  }).select("id").single();

  if (autoExecute) {
    // Mark action as executing and invoke mission-executor
    await supabase.from("mission_actions").update({
      status: "approved",
    }).eq("id", action.id);

    // Create executed pending action record
    await supabase.from("ai_pending_actions").insert({
      user_id: action.user_id,
      decision_log_id: decisionLog?.id,
      partner_id: action.partner_id,
      email_address: targetEmail,
      action_type: mapActionType(action.action_type),
      action_payload: {},
      reasoning: `Cadence auto-execution: trigger "${trigger}" met`,
      confidence: 0.85,
      source: "cadence_engine",
      status: "executed",
      executed_at: new Date().toISOString(),
    });

    counters.executed();
  } else {
    // Create pending action for human review
    await supabase.from("ai_pending_actions").insert({
      user_id: action.user_id,
      decision_log_id: decisionLog?.id,
      partner_id: action.partner_id,
      email_address: targetEmail,
      action_type: mapActionType(action.action_type),
      action_payload: {},
      reasoning: `Cadence trigger "${trigger}" met. Awaiting review.`,
      confidence: 0.85,
      source: "cadence_engine",
      status: "pending",
    });

    counters.pendingReview();
  }

  // Schedule next step if sequence exists
  await scheduleNextStep(supabase, action);
}

async function checkTriggerCondition(
  supabase: ReturnType<typeof createClient>,
  trigger: string,
  action: ActionRow,
  targetEmail: string | null,
): Promise<{ met: boolean; reason?: string }> {
  if (trigger === "immediate" || trigger === "time_based") {
    return { met: true };
  }

  if (!targetEmail || !action.user_id) return { met: true };

  // Get latest classification for this email since parent action
  let sinceDate: string | null = null;
  if (action.parent_action_id) {
    const { data: parent } = await supabase
      .from("mission_actions")
      .select("completed_at")
      .eq("id", action.parent_action_id)
      .single();
    sinceDate = parent?.completed_at ?? null;
  }

  let q = supabase
    .from("email_classifications")
    .select("category, sentiment, classified_at")
    .eq("user_id", action.user_id)
    .eq("email_address", targetEmail)
    .eq("direction", "inbound")
    .order("classified_at", { ascending: false })
    .limit(1);

  if (sinceDate) q = q.gte("classified_at", sinceDate);

  const { data: classifications } = await q;
  const latest = classifications?.[0];

  switch (trigger) {
    case "no_response":
      if (!latest) return { met: true }; // No response → proceed
      if (latest.sentiment === "positive") return { met: false, reason: "positive_response_received" };
      if (latest.sentiment === "negative") return { met: false, reason: "negative_response_received" };
      return { met: false, reason: "response_received" };

    case "negative_response":
      if (!latest) return { met: false, reason: "no_response_yet" };
      return latest.sentiment === "negative" ? { met: true } : { met: false, reason: "not_negative" };

    case "positive_response":
      if (!latest) return { met: false, reason: "no_response_yet" };
      return latest.sentiment === "positive" ? { met: true } : { met: false, reason: "not_positive" };

    default:
      return { met: true };
  }
}

async function scheduleNextStep(
  supabase: ReturnType<typeof createClient>,
  action: ActionRow,
) {
  const rule = action.cadence_rule;
  if (!rule?.sequence?.length) return;

  const currentStep = rule.current_step ?? 0;
  const nextStep = currentStep + 1;
  const maxAttempts = rule.max_attempts ?? rule.sequence.length;

  if (nextStep >= maxAttempts || nextStep >= rule.sequence.length) return;

  const nextChannel = rule.sequence[nextStep];
  const delayDays = rule.delay_days ?? 3;

  await supabase.from("mission_actions").insert({
    mission_id: action.mission_id,
    user_id: action.user_id,
    partner_id: action.partner_id,
    contact_id: action.contact_id,
    action_type: nextChannel,
    status: "pending",
    position: action.position + 1,
    scheduled_at: new Date(Date.now() + delayDays * 86400000).toISOString(),
    trigger_condition: "no_response",
    parent_action_id: action.id,
    cadence_rule: { ...rule, current_step: nextStep },
  });
}

function mapActionType(type: string): string {
  const map: Record<string, string> = {
    email: "send_email",
    phone: "create_task",
    whatsapp: "send_whatsapp",
    linkedin: "change_channel",
  };
  return map[type] || "send_email";
}
