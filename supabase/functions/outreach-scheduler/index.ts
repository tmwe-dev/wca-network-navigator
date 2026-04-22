/**
 * outreach-scheduler — Cron-invoked edge function that processes pending outreach schedules.
 * Pattern: SELECT FOR UPDATE SKIP LOCKED, batch 20, wall clock 50s, exponential backoff on error.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { startMetrics, endMetrics, logEdgeError } from "../_shared/monitoring.ts";

const MAX_WALL_CLOCK_MS = 50_000;
const BATCH_SIZE = 20;

serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);
  const metrics = startMetrics("outreach-scheduler");

  try {
    // Service role client for cron invocations
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const startTime = Date.now();

    // Acquire batch using the DB function (FOR UPDATE SKIP LOCKED)
    const { data: batch, error: batchErr } = await supabase.rpc("acquire_outreach_batch", { p_limit: BATCH_SIZE });

    if (batchErr) {
      endMetrics(metrics, false, 500);
      return new Response(JSON.stringify({ error: batchErr.message }), {
        status: 500, headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    if (!batch || batch.length === 0) {
      endMetrics(metrics, true, 200);
      return new Response(JSON.stringify({ processed: 0, failed: 0, skipped: 0, message: "No pending schedules" }), {
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }


    let processed = 0;
    let failed = 0;
    let skipped = 0;

    for (const schedule of batch) {
      // Wall clock guard
      if (Date.now() - startTime > MAX_WALL_CLOCK_MS) {
        // Release remaining items back to pending
        const remaining = batch.slice(batch.indexOf(schedule));
        for (const r of remaining) {
          await supabase.from("outreach_schedules").update({
            status: "pending",
            attempt: r.attempt, // keep the incremented attempt
          }).eq("id", r.id);
          skipped++;
        }
        break;
      }

      try {
        const result = await processSchedule(supabase, schedule);

        if (result.skipped) {
          await supabase.from("outreach_schedules").update({
            status: "skipped",
            result: result as unknown as Record<string, unknown>,
            updated_at: new Date().toISOString(),
          }).eq("id", schedule.id);
          skipped++;
        } else {
          await supabase.from("outreach_schedules").update({
            status: "done",
            result: result as unknown as Record<string, unknown>,
            updated_at: new Date().toISOString(),
          }).eq("id", schedule.id);
          processed++;

          // Schedule followups if applicable
          await scheduleFollowups(supabase, schedule);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);

        if (schedule.attempt >= schedule.max_attempts) {
          // Max retries exceeded
          await supabase.from("outreach_schedules").update({
            status: "error",
            last_error: errorMsg,
            updated_at: new Date().toISOString(),
          }).eq("id", schedule.id);
          failed++;
        } else {
          // Exponential backoff: 5min * 2^attempt
          const backoffMs = 5 * 60 * 1000 * Math.pow(2, schedule.attempt);
          const nextRun = new Date(Date.now() + backoffMs).toISOString();
          await supabase.from("outreach_schedules").update({
            status: "pending",
            last_error: errorMsg,
            run_at: nextRun,
            updated_at: new Date().toISOString(),
          }).eq("id", schedule.id);
          failed++;
        }
      }
    }

    // Update mission progress
    const missionIds = [...new Set(batch.map((s: { mission_id: string }) => s.mission_id))];
    for (const mId of missionIds) {
      try {
        await supabase.rpc("update_mission_progress", { p_mission_id: mId });
      } catch (_) { /* mission progress is best-effort */ }
    }

    const summary = { processed, failed, skipped, batch_size: batch.length };
    endMetrics(metrics, true, 200);

    return new Response(JSON.stringify(summary), {
      headers: { ...dynCors, "Content-Type": "application/json" },
    });

  } catch (err) {
    logEdgeError("outreach-scheduler", err);
    endMetrics(metrics, false, 500);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }), {
      status: 500, headers: { ...dynCors, "Content-Type": "application/json" },
    });
  }
});

// ━━━ Process a single schedule item ━━━
interface ScheduleRow {
  id: string;
  mission_id: string;
  contact_id: string | null;
  user_id: string;
  action: string;
  attempt: number;
  max_attempts: number;
  scheduled_for_followup_step: number | null;
}

async function processSchedule(
  supabase: ReturnType<typeof createClient>,
  schedule: ScheduleRow
): Promise<Record<string, unknown>> {
  // Load mission
  const { data: mission } = await supabase
    .from("outreach_missions")
    .select("id, channel, status, template_id, ai_prompt, schedule_config")
    .eq("id", schedule.mission_id)
    .single();

  if (!mission) {
    return { skipped: true, reason: "Mission not found" };
  }

  if (mission.status === "paused" || mission.status === "cancelled") {
    return { skipped: true, reason: `Mission is ${mission.status}` };
  }

  switch (schedule.action) {
    case "send":
      return await executeSendAction(supabase, schedule, mission);
    case "followup":
      return await executeFollowupAction(supabase, schedule, mission);
    case "check_reply":
      return await executeCheckReplyAction(supabase, schedule, mission);
    default:
      return { skipped: true, reason: `Unknown action: ${schedule.action}` };
  }
}

async function executeSendAction(
  supabase: ReturnType<typeof createClient>,
  schedule: ScheduleRow,
  mission: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (!schedule.contact_id) {
    return { skipped: true, reason: "No contact_id" };
  }

  // Check if already sent (idempotency)
  const { data: existing } = await supabase
    .from("mission_actions")
    .select("id")
    .eq("mission_id", schedule.mission_id)
    .eq("contact_id", schedule.contact_id)
    .eq("action_type", mission.channel as string)
    .eq("status", "completed")
    .limit(1);

  if (existing && existing.length > 0) {
    return { skipped: true, reason: "Already sent" };
  }

  // Create mission_action in 'approved' status for the slot system to pick up
  const { error: actionErr } = await supabase
    .from("mission_actions")
    .insert({
      mission_id: schedule.mission_id,
      user_id: schedule.user_id,
      contact_id: schedule.contact_id,
      action_type: mission.channel as string,
      status: "approved",
      payload: {
        template_id: mission.template_id,
        ai_prompt: mission.ai_prompt,
        followup_step: 0,
        scheduled_by: "outreach-scheduler",
      },
      position: 0,
    });

  if (actionErr) throw new Error(`Failed to create mission_action: ${actionErr.message}`);

  return { sent: true, action: "mission_action_created" };
}

async function executeFollowupAction(
  supabase: ReturnType<typeof createClient>,
  schedule: ScheduleRow,
  mission: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (!schedule.contact_id) {
    return { skipped: true, reason: "No contact_id for followup" };
  }

  // Check if contact has replied (skip followup if replied)
  const { data: replies } = await supabase
    .from("activities")
    .select("id")
    .eq("partner_id", schedule.contact_id)
    .eq("response_received", true)
    .limit(1);

  if (replies && replies.length > 0) {
    return { skipped: true, reason: "Contact already replied" };
  }

  // Create followup action
  const { error: actionErr } = await supabase
    .from("mission_actions")
    .insert({
      mission_id: schedule.mission_id,
      user_id: schedule.user_id,
      contact_id: schedule.contact_id,
      action_type: mission.channel as string,
      status: "approved",
      payload: {
        template_id: mission.template_id,
        ai_prompt: mission.ai_prompt,
        followup_step: schedule.scheduled_for_followup_step ?? 1,
        is_followup: true,
        scheduled_by: "outreach-scheduler",
      },
      position: 0,
    });

  if (actionErr) throw new Error(`Failed to create followup action: ${actionErr.message}`);

  return { sent: true, action: "followup_created", step: schedule.scheduled_for_followup_step };
}

async function executeCheckReplyAction(
  supabase: ReturnType<typeof createClient>,
  schedule: ScheduleRow,
  _mission: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (!schedule.contact_id) {
    return { skipped: true, reason: "No contact_id for check_reply" };
  }

  // Check recent inbound messages for this contact
  const { data: contact } = await supabase
    .from("imported_contacts")
    .select("email")
    .eq("id", schedule.contact_id)
    .single();

  if (!contact?.email) {
    return { skipped: true, reason: "Contact has no email" };
  }

  const { data: inbound } = await supabase
    .from("channel_messages")
    .select("id, subject, created_at")
    .eq("from_address", contact.email.toLowerCase())
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .limit(1);

  const hasReply = inbound && inbound.length > 0;

  return { checked: true, has_reply: hasReply, latest_reply: inbound?.[0] || null };
}

// ━━━ Schedule followups based on mission config ━━━
async function scheduleFollowups(
  supabase: ReturnType<typeof createClient>,
  schedule: ScheduleRow
): Promise<void> {
  if (schedule.action !== "send") return;

  const { data: mission } = await supabase
    .from("outreach_missions")
    .select("schedule_config")
    .eq("id", schedule.mission_id)
    .single();

  if (!mission?.schedule_config) return;

  const config = mission.schedule_config as { followup_steps?: Array<{ delay_days: number; if_no_reply?: boolean }> };
  if (!config.followup_steps?.length) return;

  const now = Date.now();
  const followups = config.followup_steps.map((step, idx) => ({
    mission_id: schedule.mission_id,
    contact_id: schedule.contact_id,
    user_id: schedule.user_id,
    action: "followup" as const,
    run_at: new Date(now + step.delay_days * 24 * 60 * 60 * 1000).toISOString(),
    status: "pending" as const,
    scheduled_for_followup_step: idx + 1,
  }));

  if (followups.length > 0) {
    // Also schedule a check_reply before each followup (1 hour before)
    const checks = followups.map((f) => ({
      mission_id: schedule.mission_id,
      contact_id: schedule.contact_id,
      user_id: schedule.user_id,
      action: "check_reply" as const,
      run_at: new Date(new Date(f.run_at).getTime() - 60 * 60 * 1000).toISOString(),
      status: "pending" as const,
      scheduled_for_followup_step: f.scheduled_for_followup_step,
    }));

    const { error } = await supabase.from("outreach_schedules").insert([...followups, ...checks]);
    if (error) console.error("[outreach-scheduler] Failed to schedule followups:", error.message);
  }
}
