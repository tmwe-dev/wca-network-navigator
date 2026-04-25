/**
 * agent-autopilot-worker — Cron-invoked (every 10 min) edge function.
 * Advances active autopilot missions: checks KPI/budget, invokes agent-loop.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { getSecurityHeaders } from "../_shared/securityHeaders.ts";
import { startMetrics, endMetrics, logEdgeError } from "../_shared/monitoring.ts";
import { cronGuardCheck, cronGuardLogRun } from "../_shared/cronGuard.ts";

const BATCH_SIZE = 5;
const MAX_WALL_CLOCK_MS = 55_000;

interface MissionRow {
  id: string;
  agent_id: string;
  owner_user_id: string;
  title: string;
  goal_description: string | null;
  goal_type: string;
  kpi_target: Record<string, number | string>;
  kpi_current: Record<string, number>;
  budget: Record<string, number>;
  budget_consumed: Record<string, number>;
  approval_only_for: string[];
  autopilot: boolean;
  status: string;
}

interface ProcessResult {
  mission_id: string;
  outcome: "advanced" | "completed" | "budget_exhausted" | "deadline_passed" | "error";
  detail?: string;
}

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const origin = req.headers.get("origin");
  const corsH = getCorsHeaders(origin);
  const headers = getSecurityHeaders(corsH);
  const metrics = startMetrics("agent-autopilot-worker");

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // ━━━ Cron Guard ━━━
    const guard = await cronGuardCheck(supabase, {
      jobName: "autopilot_worker",
      enabledKey: "cron_autopilot_worker_enabled",
      intervalKey: "cron_autopilot_worker_interval_min",
      defaultIntervalMin: 30,
    });
    if (guard.skip) {
      endMetrics(metrics, true, 200);
      return new Response(
        JSON.stringify({ skipped: true, reason: guard.reason, next_in_min: (guard as any).nextInMin }),
        { status: 200, headers }
      );
    }

    const startTime = Date.now();

    // Fetch active autopilot missions
    const { data: missions, error: fetchErr } = await supabase
      .from("agent_missions")
      .select("*")
      .eq("status", "active")
      .eq("autopilot", true)
      .limit(BATCH_SIZE);

    if (fetchErr) throw fetchErr;
    if (!missions || missions.length === 0) {
      endMetrics(metrics, true, 200);
      await cronGuardLogRun(supabase, "autopilot_worker", { processed: 0 });
      return new Response(JSON.stringify({ processed: 0, results: [] }), { status: 200, headers });
    }

    const results: ProcessResult[] = [];

    for (const mission of missions as MissionRow[]) {
      if (Date.now() - startTime > MAX_WALL_CLOCK_MS) break;

      try {
        const result = await processMission(supabase, mission);
        results.push(result);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ mission_id: mission.id, outcome: "error", detail: msg });
        await logMissionEvent(supabase, mission.id, "error", { error: msg });
      }
    }

    endMetrics(metrics, true, 200);
    await cronGuardLogRun(supabase, "autopilot_worker", { processed: results.length });
    return new Response(JSON.stringify({
      processed: results.length,
      results,
    }), { status: 200, headers });

  } catch (error: unknown) {
    logEdgeError("agent-autopilot-worker", error);
    endMetrics(metrics, false, 500);
    const message = error instanceof Error ? error.message : String(error);
    try {
      const sb = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { persistSession: false } }
      );
      await cronGuardLogRun(sb, "autopilot_worker", {}, message);
    } catch (_) { /* ignore */ }
    return new Response(JSON.stringify({ error: message }), { status: 500, headers });
  }
});

async function processMission(
  supabase: ReturnType<typeof createClient>,
  mission: MissionRow
): Promise<ProcessResult> {
  const { id, kpi_target, kpi_current, budget, budget_consumed } = mission;

  // ── Check deadline ──
  const deadline = kpi_target.deadline as string | undefined;
  if (deadline && new Date(deadline) < new Date()) {
    // Check if KPI met
    const kpiMet = checkKpiMet(kpi_target, kpi_current);
    const newStatus = kpiMet ? "completed" : "failed";
    await updateMissionStatus(supabase, id, newStatus);
    await logMissionEvent(supabase, id, "deadline_reached", { kpi_current, kpi_met: kpiMet });
    return { mission_id: id, outcome: kpiMet ? "completed" : "deadline_passed" };
  }

  // ── Check KPI target met ──
  if (checkKpiMet(kpi_target, kpi_current)) {
    await updateMissionStatus(supabase, id, "completed");
    await logMissionEvent(supabase, id, "kpi_target_reached", { kpi_current });
    return { mission_id: id, outcome: "completed" };
  }

  // ── Check budget ──
  if (checkBudgetExhausted(budget, budget_consumed)) {
    await updateMissionStatus(supabase, id, "budget_exhausted");
    await logMissionEvent(supabase, id, "budget_exhausted", { budget_consumed });
    return { mission_id: id, outcome: "budget_exhausted" };
  }

  // ── Invoke agent-loop ──
  const budgetRemaining: Record<string, number> = {};
  for (const [key, limit] of Object.entries(budget)) {
    budgetRemaining[key] = limit - (budget_consumed[key] ?? 0);
  }

  await logMissionEvent(supabase, id, "autopilot_tick", {
    kpi_current,
    budget_remaining: budgetRemaining,
  });

  // Call agent-loop edge function
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const agentResp = await fetch(`${supabaseUrl}/functions/v1/agent-execute`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      agent_id: mission.agent_id,
      user_id: mission.owner_user_id,
      mission_id: mission.id,
      autopilot: true,
      goal: mission.goal_description ?? mission.title,
      kpi_current,
      kpi_target,
      budget_remaining: budgetRemaining,
      approval_only_for: mission.approval_only_for,
    }),
  });

  if (!agentResp.ok) {
    const errText = await agentResp.text();
    await logMissionEvent(supabase, id, "agent_error", { status: agentResp.status, error: errText });
    return { mission_id: id, outcome: "error", detail: `agent-execute ${agentResp.status}` };
  }

  const agentResult = await agentResp.json();

  // Update budget_consumed
  const actionsUsed = agentResult.actions_executed ?? 0;
  const tokensUsed = agentResult.tokens_used ?? 0;
  const emailsSent = agentResult.emails_sent ?? 0;

  const newConsumed = {
    ...budget_consumed,
    max_actions: (budget_consumed.max_actions ?? 0) + actionsUsed,
    max_tokens: (budget_consumed.max_tokens ?? 0) + tokensUsed,
    max_emails_sent: (budget_consumed.max_emails_sent ?? 0) + emailsSent,
  };

  await supabase.from("agent_missions")
    .update({ budget_consumed: newConsumed })
    .eq("id", id);

  await logMissionEvent(supabase, id, "tick_completed", {
    actions_executed: actionsUsed,
    tokens_used: tokensUsed,
    emails_sent: emailsSent,
    budget_consumed: newConsumed,
  });

  return { mission_id: id, outcome: "advanced", detail: `${actionsUsed} actions` };
}

function checkKpiMet(
  target: Record<string, number | string>,
  current: Record<string, number>
): boolean {
  for (const [key, val] of Object.entries(target)) {
    if (key === "deadline") continue;
    const numTarget = typeof val === "number" ? val : Number(val);
    if (isNaN(numTarget)) continue;
    if ((current[key] ?? 0) < numTarget) return false;
  }
  return true;
}

function checkBudgetExhausted(
  budget: Record<string, number>,
  consumed: Record<string, number>
): boolean {
  for (const [key, limit] of Object.entries(budget)) {
    if ((consumed[key] ?? 0) >= limit) return true;
  }
  return false;
}

async function updateMissionStatus(
  supabase: ReturnType<typeof createClient>,
  missionId: string,
  status: string
) {
  const updates: Record<string, unknown> = { status };
  if (status === "completed" || status === "failed" || status === "budget_exhausted") {
    updates.completed_at = new Date().toISOString();
  }
  await supabase.from("agent_missions").update(updates).eq("id", missionId);
}

async function logMissionEvent(
  supabase: ReturnType<typeof createClient>,
  missionId: string,
  eventType: string,
  payload: Record<string, unknown>
) {
  await supabase.from("agent_mission_events").insert({
    mission_id: missionId,
    event_type: eventType,
    payload,
  });
}
