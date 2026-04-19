/**
 * costGuardrail.ts — Shared cost guardrail for AI token and TTS character budgets.
 * Checks and increments daily usage per user against caps.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

interface BudgetCheck {
  allowed: boolean;
  aiTokensUsed: number;
  aiTokenCap: number;
  ttsCharsUsed: number;
  ttsCharCap: number;
  reason?: string;
}

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

/**
 * Kill-switch: per uso interno aziendale i budget sono disattivati.
 * Riattivare in scenario commerciale settando AI_USAGE_LIMITS_ENABLED=true.
 */
function limitsEnabled(): boolean {
  return Deno.env.get("AI_USAGE_LIMITS_ENABLED") === "true";
}

/**
 * Checks if user is within daily budget. Returns allowed=false if cap exceeded.
 */
export async function checkDailyBudget(
  userId: string,
  type: "ai" | "tts",
  requestedAmount: number,
): Promise<BudgetCheck> {
  if (!limitsEnabled()) {
    return {
      allowed: true,
      aiTokensUsed: 0,
      aiTokenCap: Number.MAX_SAFE_INTEGER,
      ttsCharsUsed: 0,
      ttsCharCap: Number.MAX_SAFE_INTEGER,
    };
  }
  const sb = getServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data } = await sb
    .from("usage_daily_budget")
    .select("*")
    .eq("user_id", userId)
    .eq("usage_date", today)
    .maybeSingle();

  const row = data as Record<string, unknown> | null;
  const aiUsed = (row?.ai_tokens_used as number) ?? 0;
  const ttsUsed = (row?.tts_chars_used as number) ?? 0;
  const aiCap = (row?.ai_token_cap as number) ?? 500_000;
  const ttsCap = (row?.tts_char_cap as number) ?? 50_000;

  const result: BudgetCheck = {
    allowed: true,
    aiTokensUsed: aiUsed,
    aiTokenCap: aiCap,
    ttsCharsUsed: ttsUsed,
    ttsCharCap: ttsCap,
  };

  if (type === "ai" && aiUsed + requestedAmount > aiCap) {
    result.allowed = false;
    result.reason = `Budget AI giornaliero esaurito (${aiUsed}/${aiCap} token)`;
  }
  if (type === "tts" && ttsUsed + requestedAmount > ttsCap) {
    result.allowed = false;
    result.reason = `Budget TTS giornaliero esaurito (${ttsUsed}/${ttsCap} caratteri)`;
  }

  return result;
}

/**
 * Records usage after a successful API call.
 */
export async function recordUsage(
  userId: string,
  type: "ai" | "tts",
  amount: number,
): Promise<void> {
  const sb = getServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: existing } = await sb
    .from("usage_daily_budget")
    .select("id, ai_tokens_used, tts_chars_used")
    .eq("user_id", userId)
    .eq("usage_date", today)
    .maybeSingle();

  if (existing) {
    const row = existing as Record<string, unknown>;
    const updateField = type === "ai" ? "ai_tokens_used" : "tts_chars_used";
    const currentVal = (row[updateField] as number) ?? 0;
    await sb
      .from("usage_daily_budget")
      .update({ [updateField]: currentVal + amount, updated_at: new Date().toISOString() })
      .eq("id", row.id as string);
  } else {
    await sb
      .from("usage_daily_budget")
      .insert({
        user_id: userId,
        usage_date: today,
        ai_tokens_used: type === "ai" ? amount : 0,
        tts_chars_used: type === "tts" ? amount : 0,
      });
  }
}

/**
 * Returns a 429 response when budget is exceeded.
 */
export function budgetExceededResponse(
  budget: BudgetCheck,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(
    JSON.stringify({
      error: "daily_budget_exceeded",
      message: budget.reason ?? "Budget giornaliero esaurito",
      ai_tokens_used: budget.aiTokensUsed,
      ai_token_cap: budget.aiTokenCap,
      tts_chars_used: budget.ttsCharsUsed,
      tts_char_cap: budget.ttsCharCap,
    }),
    {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}
