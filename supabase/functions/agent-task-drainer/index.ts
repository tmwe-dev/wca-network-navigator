/**
 * agent-task-drainer — Cron-invoked (every 5 min) edge function.
 * Drains pending agent_tasks by invoking agent-execute per task.
 *
 * Behavior per tick:
 *   1) Stuck detection: tasks running >10min → marked failed
 *   2) Skip users with ai_automations_paused=true
 *   3) Lock batch (max 10) via UPDATE … FOR UPDATE SKIP LOCKED
 *   4) Execute concurrently (max 3 in parallel, 15s timeout per task)
 *   5) Wall-clock cap 55s
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { getSecurityHeaders } from "../_shared/securityHeaders.ts";
import { startMetrics, endMetrics, logEdgeError } from "../_shared/monitoring.ts";

const BATCH_SIZE = 25;
const MAX_CONCURRENT = 5;
const TASK_TIMEOUT_MS = 15_000;
const STUCK_THRESHOLD_MINUTES = 10;
const MAX_WALL_CLOCK_MS = 55_000;

interface TaskRow {
  id: string;
  agent_id: string;
  user_id: string;
  task_type: string;
}

interface ExecResult {
  task_id: string;
  outcome: "completed" | "failed" | "timeout" | "exec_error";
  detail?: string;
}

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const origin = req.headers.get("origin");
  const corsH = getCorsHeaders(origin);
  const headers = getSecurityHeaders(corsH);
  const metrics = startMetrics("agent-task-drainer");

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const startTime = Date.now();

  try {
    // ─── 1. Stuck detection: reset tasks running >10 min ───
    const stuckCutoff = new Date(Date.now() - STUCK_THRESHOLD_MINUTES * 60_000).toISOString();
    const { data: stuckRows, error: stuckErr } = await supabase
      .from("agent_tasks")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        result_summary: `timeout: stuck >${STUCK_THRESHOLD_MINUTES}min`,
      })
      .eq("status", "running")
      .lt("started_at", stuckCutoff)
      .select("id");

    if (stuckErr) {
      console.error("stuck reset error:", stuckErr);
    }
    const stuckResetCount = stuckRows?.length ?? 0;
    if (stuckResetCount > 0) {
      console.log(`[drainer] stuck_reset=${stuckResetCount}`);
    }

    // ─── 2. Load paused users ───
    const { data: pausedSettings } = await supabase
      .from("app_settings")
      .select("user_id, value")
      .eq("key", "ai_automations_paused");

    const pausedUsers = new Set<string>();
    for (const row of pausedSettings ?? []) {
      const v = (row as { value: unknown }).value;
      const isTrue =
        v === true ||
        v === "true" ||
        (typeof v === "object" && v !== null && JSON.stringify(v) === "true");
      const uid = (row as { user_id: string | null }).user_id;
      if (isTrue && uid) pausedUsers.add(uid);
    }

    // ─── 3. Lock batch via RPC-like UPDATE ───
    // Postgres FOR UPDATE SKIP LOCKED requires raw SQL. Use rpc to a SQL fn?
    // Workaround: select candidate IDs, then update with returning, race-safe enough at 5min cron.
    let candidateQuery = supabase
      .from("agent_tasks")
      .select("id, agent_id, user_id, task_type")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (pausedUsers.size > 0) {
      candidateQuery = candidateQuery.not(
        "user_id",
        "in",
        `(${Array.from(pausedUsers).map((u) => `"${u}"`).join(",")})`,
      );
    }

    const { data: candidates, error: candErr } = await candidateQuery;
    if (candErr) throw candErr;

    if (!candidates || candidates.length === 0) {
      endMetrics(metrics, true, 200);
      return new Response(
        JSON.stringify({
          processed: 0,
          completed: 0,
          failed: 0,
          stuck_reset: stuckResetCount,
          paused_users_skipped: pausedUsers.size,
        }),
        { status: 200, headers },
      );
    }

    const candidateIds = candidates.map((c) => c.id);

    // Atomic claim: update only rows still pending
    const { data: claimed, error: claimErr } = await supabase
      .from("agent_tasks")
      .update({ status: "running", started_at: new Date().toISOString() })
      .in("id", candidateIds)
      .eq("status", "pending")
      .select("id, agent_id, user_id, task_type");

    if (claimErr) throw claimErr;
    const tasks = (claimed ?? []) as TaskRow[];

    if (tasks.length === 0) {
      endMetrics(metrics, true, 200);
      return new Response(
        JSON.stringify({
          processed: 0,
          completed: 0,
          failed: 0,
          stuck_reset: stuckResetCount,
          paused_users_skipped: pausedUsers.size,
          note: "candidates lost race",
        }),
        { status: 200, headers },
      );
    }

    console.log(`[drainer] claimed=${tasks.length} stuck_reset=${stuckResetCount}`);

    // ─── 4. Execute concurrently (chunks of MAX_CONCURRENT) ───
    const results: ExecResult[] = [];
    for (let i = 0; i < tasks.length; i += MAX_CONCURRENT) {
      if (Date.now() - startTime > MAX_WALL_CLOCK_MS) {
        console.log("[drainer] wall-clock cap hit, breaking");
        break;
      }
      const chunk = tasks.slice(i, i + MAX_CONCURRENT);
      const chunkResults = await Promise.all(
        chunk.map((t) => executeTask(supabase, supabaseUrl, serviceKey, t)),
      );
      results.push(...chunkResults);
    }

    const completed = results.filter((r) => r.outcome === "completed").length;
    const failed = results.length - completed;

    endMetrics(metrics, true, 200);
    return new Response(
      JSON.stringify({
        processed: results.length,
        completed,
        failed,
        stuck_reset: stuckResetCount,
        paused_users_skipped: pausedUsers.size,
        results,
      }),
      { status: 200, headers },
    );
  } catch (error: unknown) {
    logEdgeError("agent-task-drainer", error);
    endMetrics(metrics, false, 500);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers,
    });
  }
});

async function executeTask(
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceKey: string,
  task: TaskRow,
): Promise<ExecResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TASK_TIMEOUT_MS);

  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/agent-execute`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        agent_id: task.agent_id,
        task_id: task.id,
        user_id: task.user_id,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      await markFailed(supabase, task.id, `agent-execute ${resp.status}: ${errText.slice(0, 200)}`);
      return { task_id: task.id, outcome: "failed", detail: `HTTP ${resp.status}` };
    }

    // Drain body to free resources
    await resp.text().catch(() => "");

    // agent-execute updates status internally (running → completed/failed via handleGeneralTask).
    // We don't override; stuck-reset will recover anything left in 'running' >10min.
    return { task_id: task.id, outcome: "completed" };
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const isTimeout = err instanceof DOMException && err.name === "AbortError";
    const detail = isTimeout
      ? `timeout after ${TASK_TIMEOUT_MS}ms`
      : err instanceof Error
        ? err.message
        : String(err);
    await markFailed(supabase, task.id, `drainer: ${detail}`);
    return {
      task_id: task.id,
      outcome: isTimeout ? "timeout" : "exec_error",
      detail,
    };
  }
}

async function markFailed(
  supabase: ReturnType<typeof createClient>,
  taskId: string,
  reason: string,
): Promise<void> {
  await supabase
    .from("agent_tasks")
    .update({
      status: "failed",
      completed_at: new Date().toISOString(),
      result_summary: reason.slice(0, 500),
    })
    .eq("id", taskId)
    .eq("status", "running");
}