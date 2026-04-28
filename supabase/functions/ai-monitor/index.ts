/**
 * ai-monitor — Aggregated AI cost dashboard endpoint.
 *
 * GET /ai-monitor (with auth): returns:
 *  - todayTotal, monthTotal, weekTotal (period totals)
 *  - todayByGroup
 *  - dailyHistory (30 days)
 *  - topFunctions (last 7 days)
 *  - sizeDistribution (last 7 days)
 *  - cronVsUser (today)
 *  - budget config + percentages
 *
 * Backed by RPCs in migration 20260425023330.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders } from "../_shared/cors.ts";

function jsonResponse(data: unknown, corsHeaders: Record<string, string>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "missing_auth" }, corsHeaders, 401);
    }

    // Validate JWT and resolve user
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return jsonResponse({ error: "invalid_token" }, corsHeaders, 401);
    }
    const userId = userData.user.id;

    // Use service role for aggregations
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      todayTotalRes,
      monthTotalRes,
      weekTotalRes,
      todayByGroupRes,
      dailyHistoryRes,
      topFunctionsRes,
      sizeDistRes,
      cronVsUserRes,
      budgetRes,
    ] = await Promise.all([
      admin.rpc("get_period_total", { p_user_id: userId, p_period_start: startOfDay.toISOString() }),
      admin.rpc("get_period_total", { p_user_id: userId, p_period_start: startOfMonth.toISOString() }),
      admin.rpc("get_period_total", { p_user_id: userId, p_period_start: sevenDaysAgo.toISOString() }),
      admin.rpc("get_today_by_group", { p_user_id: userId }),
      admin.rpc("get_daily_history", { p_user_id: userId, p_days: 30 }),
      admin.rpc("get_top_functions", { p_user_id: userId, p_since: sevenDaysAgo.toISOString(), p_limit: 10 }),
      admin.rpc("get_prompt_size_distribution", { p_user_id: userId, p_days: 7 }),
      admin.rpc("get_cron_vs_user", { p_user_id: userId }),
      admin
        .from("ai_budget_config")
        .select("monthly_budget_usd, alert_threshold_percent, subscription_start, subscription_end")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    const errors: Record<string, unknown> = {};
    [
      ["todayTotal", todayTotalRes],
      ["monthTotal", monthTotalRes],
      ["weekTotal", weekTotalRes],
      ["todayByGroup", todayByGroupRes],
      ["dailyHistory", dailyHistoryRes],
      ["topFunctions", topFunctionsRes],
      ["sizeDistribution", sizeDistRes],
      ["cronVsUser", cronVsUserRes],
      ["budget", budgetRes],
    ].forEach(([k, r]) => {
      const res = r as { error?: { message?: string } };
      if (res?.error) errors[k as string] = res.error.message;
    });
    if (Object.keys(errors).length) {
      console.error("[ai-monitor] partial errors", errors);
    }

    const monthlyBudget = (budgetRes.data?.monthly_budget_usd as number) ?? 25;
    const monthSpent = ((monthTotalRes.data as Record<string, unknown> | null)?.cost_usd as number) ?? 0;
    const budgetPercentage = monthlyBudget > 0 ? (monthSpent / monthlyBudget) * 100 : 0;

    return jsonResponse({
      todayTotal: todayTotalRes.data ?? null,
      monthTotal: monthTotalRes.data ?? null,
      weekTotal: weekTotalRes.data ?? null,
      todayByGroup: todayByGroupRes.data ?? [],
      dailyHistory: dailyHistoryRes.data ?? [],
      topFunctions: topFunctionsRes.data ?? [],
      sizeDistribution: sizeDistRes.data ?? [],
      cronVsUser: cronVsUserRes.data ?? [],
      budget: {
        monthlyBudgetUsd: monthlyBudget,
        alertThresholdPercent: (budgetRes.data?.alert_threshold_percent as number) ?? 80,
        subscriptionStart: budgetRes.data?.subscription_start ?? null,
        subscriptionEnd: budgetRes.data?.subscription_end ?? null,
        monthSpentUsd: monthSpent,
        budgetPercentage,
      },
      _errors: Object.keys(errors).length ? errors : undefined,
    }, corsHeaders);
  } catch (err) {
    console.error("[ai-monitor] fatal", err);
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: "internal", message: msg }, corsHeaders, 500);
  }
});