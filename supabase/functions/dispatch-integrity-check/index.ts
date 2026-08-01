/**
 * dispatch-integrity-check — Audit coherence of executed pending actions.
 *
 * For each ai_pending_actions with status='executed' in the last 72h,
 * verifies that:
 *   1. A corresponding channel_messages (outbound) row exists
 *   2. A corresponding activities row exists
 *   3. The partner's last_outbound_at was updated
 *
 * READ-ONLY on source tables. Writes only to dispatch_integrity_report.
 * Auth: x-cron-secret header from Vault.
 * Sub-200 LOC.
 */
import { corsPreflight, getCorsHeaders } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/supabaseClient.ts";
import { createLogger } from "../_shared/structuredLogger.ts";

const WINDOW_HOURS = 72;
const MAX_DETAILS = 50;

Deno.serve(async (req: Request) => {
  const preflight = corsPreflight(req);
  if (preflight) return preflight;

  const cors = getCorsHeaders(req.headers.get("origin"));
  const log = createLogger("dispatch-integrity-check", {});

  // Auth: require cron secret
  const cronSecret = req.headers.get("x-cron-secret");
  const expectedSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || cronSecret !== expectedSecret) {
    log.warn("auth_failed", { reason: "invalid_cron_secret" });
    return new Response(
      JSON.stringify({ error: "UNAUTHORIZED", message: "Invalid cron secret" }),
      { status: 401, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  const supabase = createServiceClient();
  const since = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000).toISOString();

  // Fetch all executed pending actions in window
  const { data: executed, error: execErr } = await supabase
    .from("ai_pending_actions")
    .select("id, partner_id, action_type, executed_at")
    .eq("status", "executed")
    .gte("executed_at", since)
    .limit(500);

  if (execErr) {
    log.error("query_executed_failed", execErr);
    return new Response(
      JSON.stringify({ error: "QUERY_FAILED", message: execErr.message }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  const actions = executed ?? [];
  log.info("actions_found", { count: actions.length, window_hours: WINDOW_HOURS });

  let missingChannelMessage = 0;
  let missingActivity = 0;
  let missingPartnerTouch = 0;
  const details: Record<string, unknown>[] = [];

  for (const action of actions) {
    const issues: string[] = [];

    // Check 1: channel_messages outbound exists for this partner after execution
    const { count: cmCount } = await supabase
      .from("channel_messages")
      .select("id", { count: "exact", head: true })
      .eq("partner_id", action.partner_id)
      .eq("direction", "outbound")
      .gte("created_at", action.executed_at);

    if ((cmCount ?? 0) === 0) {
      missingChannelMessage++;
      issues.push("missing_channel_message");
    }

    // Check 2: activities row linked to partner after execution
    const { count: actCount } = await supabase
      .from("activities")
      .select("id", { count: "exact", head: true })
      .eq("partner_id", action.partner_id)
      .gte("created_at", action.executed_at);

    if ((actCount ?? 0) === 0) {
      missingActivity++;
      issues.push("missing_activity");
    }

    // Check 3: partner last_outbound_at updated
    const { data: partner } = await supabase
      .from("partners")
      .select("last_outbound_at")
      .eq("id", action.partner_id)
      .maybeSingle();

    if (!partner?.last_outbound_at || new Date(partner.last_outbound_at) < new Date(action.executed_at)) {
      missingPartnerTouch++;
      issues.push("missing_partner_touch");
    }

    if (issues.length > 0 && details.length < MAX_DETAILS) {
      details.push({
        action_id: action.id,
        partner_id: action.partner_id,
        action_type: action.action_type,
        executed_at: action.executed_at,
        issues,
      });
    }
  }

  // Write report
  const report = {
    window_hours: WINDOW_HOURS,
    total_executed: actions.length,
    missing_channel_message: missingChannelMessage,
    missing_activity: missingActivity,
    missing_partner_touch: missingPartnerTouch,
    details,
  };

  const { error: insertErr } = await supabase
    .from("dispatch_integrity_report")
    .insert(report);

  if (insertErr) {
    log.error("insert_report_failed", insertErr);
  } else {
    log.info("report_saved", {
      total: actions.length,
      missing_cm: missingChannelMessage,
      missing_act: missingActivity,
      missing_pt: missingPartnerTouch,
    });
  }

  await log.flush();

  return new Response(JSON.stringify(report), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
