/**
 * cadence-engine — Cron-triggered engine for processing scheduled follow-up actions.
 * Runs hourly, checks trigger conditions, and creates/executes pending actions.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsPreflight, getCorsHeaders } from "../_shared/cors.ts";
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
  mission_id: string;
  user_id: string;
  action_type: string;
  status: string;
  scheduled_at: string;
  cadence_rule: CadenceRule | null;
  trigger_condition: string | null;
  parent_action_id: string | null;
  position: number;
  metadata: Record<string, unknown> | null;
  retry_count?: number | null;
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
      .select("id, mission_id, user_id, action_type, status, scheduled_at, cadence_rule, trigger_condition, parent_action_id, position, metadata, retry_count")
      .lte("scheduled_at", new Date().toISOString())
      .not("scheduled_at", "is", null)
      .eq("status", "pending")
      .order("scheduled_at", { ascending: true })
      .limit(50);

    if (fetchErr) throw new Error(fetchErr.message || JSON.stringify(fetchErr));
    if (!actions?.length) {
      return new Response(JSON.stringify({ processed: 0, executed: 0, pending_review: 0, cancelled: 0 }), {
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    let executed = 0, pendingReview = 0, cancelled = 0;

    for (const action of actions as ActionRow[]) {
      try {
        // LOVABLE-93: global pause check
        const { data: pauseSettings } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "ai_automations_paused")
          .eq("user_id", action.user_id)
          .maybeSingle();

        if (pauseSettings?.value === "true") {
          console.log(`[cadence-engine] AI automations paused for user ${action.user_id}, skipping action ${action.id}`);
          continue;
        }

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
    const msg = e instanceof Error ? e.message : JSON.stringify(e);
    console.error("[cadence-engine] Fatal:", msg);
    return edgeError("INTERNAL_ERROR", msg, undefined, headers);
  }
});

async function processAction(
  supabase: ReturnType<typeof createClient>,
  action: ActionRow,
  counters: { executed: () => void; pendingReview: () => void; cancelled: () => void },
) {
  const maxAttempts = action.cadence_rule?.max_attempts ?? 5;
  if ((action as ActionRow & { retry_count?: number | null }).retry_count >= maxAttempts) {
    await supabase.from("mission_actions").update({
      status: "expired",
      completed_at: new Date().toISOString(),
      last_error: `Max attempts reached (${maxAttempts})`,
    }).eq("id", action.id);
    counters.cancelled();
    return;
  }

  await supabase.from("mission_actions").update({
    retry_count: ((action as ActionRow & { retry_count?: number | null }).retry_count || 0) + 1,
  }).eq("id", action.id);

  // Extract target email from metadata
  const meta = action.metadata as Record<string, unknown> | null;
  const targetEmail: string | null = (meta?.email_address as string) || (meta?.recipient_email as string) || null;
  const partnerId: string | null = (meta?.partner_id as string) || null;

  // Load conversation context
  let convCtx: Record<string, unknown> | null = null;
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
    partner_id: partnerId,
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

  const actionType = mapActionType(action.action_type);

  if (autoExecute) {
    // Mark action as executing and invoke mission-executor
    await supabase.from("mission_actions").update({
      status: "approved",
    }).eq("id", action.id);

    // Step 1: Generate real content via generate-outreach
    let executionResult: Record<string, unknown> = {};
    let executionStatus = "executed";

    try {
      const genResponse = await fetch(
        `${supabaseUrl}/functions/v1/generate-outreach`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            partnerId,
            email: targetEmail,
            channel: action.action_type || "email",
            userId: action.user_id,
            context: `Cadence follow-up step ${action.cadence_rule?.current_step || 0}. Trigger: ${trigger}.`,
          }),
        },
      );

      if (genResponse.ok) {
        const genData = await genResponse.json();
        executionResult = {
          subject: genData.subject,
          body: genData.body,
          channel: genData.channel || action.action_type,
          generated: true,
        };

        // Step 2: If email, attempt real send
        if (actionType === "send_email" && targetEmail && genData.body) {
          const sendResponse = await fetch(
            `${supabaseUrl}/functions/v1/send-email`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${serviceRoleKey}`,
              },
              body: JSON.stringify({
                to: targetEmail,
                subject: genData.subject,
                body: genData.body,
                userId: action.user_id,
                partnerId,
                source: "cadence_engine",
              }),
            },
          );
          executionResult.sent = sendResponse.ok;
          if (!sendResponse.ok) {
            executionStatus = "failed";
            executionResult.sendError = await sendResponse.text().catch(() => "unknown");
          }
        } else if (actionType !== "send_email") {
          // Non-email channels: queue with generated content
          executionStatus = "pending";
          executionResult.note = `Contenuto generato per canale ${action.action_type}. Invio manuale richiesto.`;
        }
      } else {
        executionStatus = "failed";
        executionResult = { error: "Content generation failed", status: genResponse.status };
      }
    } catch (execErr) {
      executionStatus = "failed";
      executionResult = { error: execErr instanceof Error ? execErr.message : "Unknown execution error" };
    }

    await supabase.from("ai_pending_actions").insert({
      user_id: action.user_id,
      decision_log_id: decisionLog?.id,
      partner_id: partnerId,
      email_address: targetEmail,
      action_type: actionType,
      action_payload: executionResult,
      reasoning: `Cadence auto-execution: trigger "${trigger}" met. Result: ${executionStatus}`,
      confidence: 0.85,
      source: "cadence_engine",
      status: executionStatus,
      executed_at: executionStatus === "executed" ? new Date().toISOString() : null,
    });

    // LOVABLE-93: audit gestito da postSendPipeline dentro send-email
    // (non dobbiamo loggare qui — avrebbe causato duplicati)

    counters.executed();
  } else {
    // Pre-generate content so reviewer sees real text
    let pendingPayload: Record<string, unknown> = {};
    try {
      const genResponse = await fetch(
        `${supabaseUrl}/functions/v1/generate-outreach`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            partnerId,
            email: targetEmail,
            channel: action.action_type || "email",
            userId: action.user_id,
            context: `Cadence follow-up step ${action.cadence_rule?.current_step || 0}. Trigger: ${trigger}. PENDING REVIEW.`,
          }),
        },
      );
      if (genResponse.ok) {
        const genData = await genResponse.json();
        pendingPayload = {
          subject: genData.subject,
          body: genData.body,
          channel: genData.channel || action.action_type,
          generated: true,
        };
      } else {
        pendingPayload = { note: "Generazione contenuto non riuscita. Creare manualmente.", status: genResponse.status };
      }
    } catch (genErr) {
      pendingPayload = { note: "Generazione contenuto fallita.", error: genErr instanceof Error ? genErr.message : String(genErr) };
    }

    await supabase.from("ai_pending_actions").insert({
      user_id: action.user_id,
      decision_log_id: decisionLog?.id,
      partner_id: partnerId,
      email_address: targetEmail,
      action_type: actionType,
      action_payload: pendingPayload,
      reasoning: `Cadence trigger "${trigger}" met. Awaiting review. Content pre-generated.`,
      confidence: 0.85,
      source: "cadence_engine",
      status: "pending",
    });

    // LOVABLE-93: audit gestito da postSendPipeline quando l'azione sarà approvata/eseguita
    // (non dobbiamo loggare qui per azioni in pending — il log avverrà al momento dell'effettivo invio)

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
  const meta = action.metadata as Record<string, unknown> | null;
  const actionPartnerId = (meta?.partner_id as string) || null;

  await supabase.from("mission_actions").insert({
    mission_id: action.mission_id,
    user_id: action.user_id,
    action_type: nextChannel,
    status: "pending",
    position: action.position + 1,
    scheduled_at: new Date(Date.now() + delayDays * 86400000).toISOString(),
    trigger_condition: "no_response",
    parent_action_id: action.id,
    cadence_rule: { ...rule, current_step: nextStep },
    metadata: {
      ...meta,
      partner_id: actionPartnerId,
      cadence_context: {
        previous_channel: action.action_type,
        previous_step: currentStep,
        sequence_position: `${nextStep + 1}/${rule.sequence.length}`,
        escalation_reason: "no_response",
        delay_days: delayDays,
      },
    },
  });
}

function mapActionType(type: string): string {
  const map: Record<string, string> = {
    email: "send_email",
    phone: "create_task",
    whatsapp: "send_whatsapp",
    linkedin: "send_linkedin",
  };
  return map[type] || "create_task";
}
