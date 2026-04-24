/**
 * pending-action-executor — Executes approved ai_pending_actions by type.
 *
 * Routes:
 *  send_email       → invoke send-email
 *  send_whatsapp    → invoke send-whatsapp
 *  send_linkedin    → invoke send-linkedin
 *  schedule_followup→ INSERT outreach_schedules
 *  create_reminder  → INSERT reminders (activity)
 *  update_lead_status → UPDATE partners
 *  send_proposal    → invoke send-email with proposal template
 *
 * Logs every execution to supervisor_audit_log.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { getSecurityHeaders } from "../_shared/securityHeaders.ts";
import { requireAuth, isAuthError } from "../_shared/authGuard.ts";
import { startMetrics, endMetrics, logEdgeError } from "../_shared/monitoring.ts";
import { logSupervisorAudit } from "../_shared/supervisorAudit.ts";
import { LeadProcessManager } from "../_shared/processManagers/leadProcessManager.ts";

interface PendingAction {
  id: string;
  user_id: string;
  action_type: string;
  action_payload: Record<string, unknown> | null;
  context: Record<string, unknown> | null;
  suggested_content: string | null;
  partner_id: string | null;
}

interface ExecutionResult {
  success: boolean;
  action_type: string;
  detail: string;
}

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const corsH = getCorsHeaders(origin);
  const headers = getSecurityHeaders(corsH);
  const metrics = startMetrics("pending-action-executor");

  try {
    // Support both authenticated user calls and service-role trigger calls
    const body = await req.json();
    const pending_action_id = body.pending_action_id ?? body.action_id;

    // Try auth but allow service-role (trigger) calls through
    const auth = await requireAuth(req, corsH);
    if (isAuthError(auth)) {
      // Check if this is a service-role call (from DB trigger)
      const authHeader = req.headers.get("authorization") ?? "";
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      if (!authHeader.includes(serviceKey)) return auth;
    } else {
      metrics.userId = auth.userId;
    }

    if (!pending_action_id) {
      endMetrics(metrics, false, 400);
      return new Response(JSON.stringify({ error: "Missing pending_action_id" }), { status: 400, headers });
    }

    // deno-lint-ignore no-explicit-any
    const supabase = createClient<any>(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Fetch the pending action
    const { data: action, error: fetchErr } = await supabase
      .from("ai_pending_actions")
      .select("*")
      .eq("id", pending_action_id)
      .eq("status", "approved")
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!action) {
      endMetrics(metrics, false, 404);
      return new Response(JSON.stringify({ error: "Action not found or not approved" }), { status: 404, headers });
    }

    const typedAction = action as unknown as PendingAction;

    // LOVABLE-93: global pause check
    const { data: pauseSettings } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "ai_automations_paused")
      .eq("user_id", typedAction.user_id)
      .maybeSingle();

    if (pauseSettings?.value === "true") {
      endMetrics(metrics, false, 200);
      return new Response(JSON.stringify({ paused: true, message: "AI automations paused" }), { status: 200, headers });
    }

    const payload = typedAction.action_payload ?? typedAction.context ?? {};

    // LOVABLE-93: Refresh context data for reply-type actions before execution
    const replyActionTypes = ["send_email", "send_proposal", "reply_interested", "reply_to_question", "handle_complaint", "send_graceful_close"];
    if (replyActionTypes.includes(typedAction.action_type)) {
      const refreshedPayload = await refreshActionContext(supabase, typedAction, payload);
      Object.assign(payload, refreshedPayload);
    }

    let result: ExecutionResult;

    try {
      result = await executeAction(supabase, typedAction, payload);
    } catch (execErr: unknown) {
      const msg = execErr instanceof Error ? execErr.message : String(execErr);
      result = { success: false, action_type: typedAction.action_type, detail: msg };
    }

    // Update pending action
    await supabase.from("ai_pending_actions").update({
      status: result.success ? "executed" : "failed",
      executed_at: new Date().toISOString(),
      execution_log: result,
    }).eq("id", pending_action_id);

    // LOVABLE-93: formato audit unificato via logSupervisorAudit
    await logSupervisorAudit(supabase, {
      user_id: typedAction.user_id,
      actor_type: "system",
      actor_name: "pending-action-executor",
      action_category: result.success ? "action_executed" : "action_failed",
      action_detail: `${typedAction.action_type}: ${result.detail}`,
      target_id: pending_action_id,
      target_type: "pending_action",
      decision_origin: "system_trigger",
      metadata: { pending_action_id, action_type: typedAction.action_type, result },
    });

    endMetrics(metrics, result.success, result.success ? 200 : 500);
    return new Response(JSON.stringify(result), { status: result.success ? 200 : 500, headers });

  } catch (error: unknown) {
    logEdgeError("pending-action-executor", error);
    endMetrics(metrics, false, 500);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers });
  }
});

async function refreshActionContext(
  // deno-lint-ignore no-explicit-any
  supabase: ReturnType<typeof createClient<any>>,
  action: PendingAction,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const refreshed: Record<string, unknown> = {};

  // Reload email_address_rules if reply_to or email_address is available
  const emailAddress = (payload.reply_to ?? payload.email_address) as string | undefined;
  if (emailAddress) {
    const { data: freshRule } = await supabase
      .from("email_address_rules")
      .select("custom_prompt, tone_override, topics_to_emphasize, topics_to_avoid, category")
      .eq("email_address", emailAddress)
      .eq("user_id", action.user_id)
      .maybeSingle();

    if (freshRule) {
      refreshed._fresh_rule = freshRule;
    }
  }

  // Reload partner lead_status if partner_id is available
  const partnerId = action.partner_id ?? (payload.partner_id as string | undefined);
  if (partnerId) {
    const { data: partner } = await supabase
      .from("partners")
      .select("lead_status")
      .eq("id", partnerId)
      .maybeSingle();

    if (partner) {
      refreshed._fresh_lead_status = partner.lead_status;
    }
  }

  // Add timestamp of refresh
  refreshed._refreshed_at = new Date().toISOString();

  return refreshed;
}

async function executeAction(
  // deno-lint-ignore no-explicit-any
  supabase: ReturnType<typeof createClient<any>>,
  action: PendingAction,
  payload: Record<string, unknown>
): Promise<ExecutionResult> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  switch (action.action_type) {
    case "send_email":
    case "send_proposal": {
      const resp = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          to: payload.to ?? payload.recipient_email ?? payload.email,
          subject: payload.subject ?? `Proposal from WCA Network`,
          html: payload.html ?? payload.body ?? payload.html_body ?? "",
          user_id: action.user_id,
          partner_id: action.partner_id ?? payload.partner_id,
        }),
      });
      if (!resp.ok) {
        const err = await resp.text();
        return { success: false, action_type: action.action_type, detail: `send-email failed: ${resp.status} ${err}` };
      }
      return { success: true, action_type: action.action_type, detail: `Email sent to ${payload.to ?? payload.recipient_email}` };
    }

    case "send_whatsapp": {
      const resp = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: payload.phone ?? payload.to,
          message: payload.message ?? payload.body ?? "",
          user_id: action.user_id,
          partner_id: action.partner_id ?? payload.partner_id,
        }),
      });
      if (!resp.ok) {
        const err = await resp.text();
        return { success: false, action_type: action.action_type, detail: `send-whatsapp failed: ${resp.status} ${err}` };
      }
      return { success: true, action_type: action.action_type, detail: `WhatsApp sent to ${payload.phone ?? payload.to}` };
    }

    case "send_linkedin": {
      const resp = await fetch(`${supabaseUrl}/functions/v1/send-linkedin`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_url: payload.profile_url ?? payload.to,
          message: String(payload.message ?? payload.body ?? "").substring(0, 300),
          user_id: action.user_id,
          partner_id: action.partner_id ?? payload.partner_id,
        }),
      });
      if (!resp.ok) {
        const err = await resp.text();
        return { success: false, action_type: action.action_type, detail: `send-linkedin failed: ${resp.status} ${err}` };
      }
      return { success: true, action_type: action.action_type, detail: `LinkedIn message sent` };
    }

    case "schedule_followup": {
      const { error } = await supabase.from("outreach_schedules").insert({
        mission_id: payload.mission_id,
        contact_id: payload.contact_id,
        action: "followup",
        run_at: payload.run_at ?? new Date(Date.now() + 3 * 86400000).toISOString(),
        status: "pending",
      });
      if (error) return { success: false, action_type: action.action_type, detail: error.message };
      return { success: true, action_type: action.action_type, detail: `Follow-up scheduled for ${payload.contact_id}` };
    }

    case "create_reminder": {
      const { error } = await supabase.from("activities").insert({
        user_id: action.user_id,
        partner_id: action.partner_id ?? payload.partner_id,
        source_type: "partner",
        source_id: (action.partner_id ?? payload.partner_id ?? action.id) as string,
        activity_type: "follow_up",
        title: String(payload.title ?? "Reminder"),
        description: String(payload.description ?? ""),
        status: "pending",
        priority: String(payload.priority ?? "normal"),
        due_date: (payload.due_date ?? new Date(Date.now() + 86400000).toISOString()) as string,
      });
      if (error) return { success: false, action_type: action.action_type, detail: error.message };
      return { success: true, action_type: action.action_type, detail: `Reminder created: ${payload.title}` };
    }

    case "update_lead_status": {
      const partnerId = action.partner_id ?? payload.partner_id;
      if (!partnerId) return { success: false, action_type: action.action_type, detail: "No partner_id" };
      const leadPM = new LeadProcessManager(supabase);
      // deno-lint-ignore no-explicit-any
      const transResult = await leadPM.requestTransition(partnerId as string, action.user_id, payload.new_status as any, {
        trigger: `Pending action update_lead_status approvata`,
        actor: { type: "ai_agent", name: "pending-action-executor" },
        decisionOrigin: "ai_approved",
      });
      if (!transResult.applied) return { success: false, action_type: action.action_type, detail: transResult.blockedReason || "Transition blocked" };
      return { success: true, action_type: action.action_type, detail: `Lead status → ${payload.new_status}` };
    }

    default:
      return { success: false, action_type: action.action_type, detail: `Unknown action_type: ${action.action_type}` };
  }
}
