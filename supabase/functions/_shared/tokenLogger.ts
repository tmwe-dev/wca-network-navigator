/**
 * tokenLogger — Token usage tracking and budget management
 *
 * Provides:
 *  - logTokenUsage() — record token consumption
 *  - getTodayTokenUsage() — sum tokens used today
 *  - getMonthTokenUsage() — sum tokens used this month
 *  - checkTokenBudget() — validate against limits
 *  - loadTokenSettings() — fetch all ai_* settings
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface TokenUsageRecord {
  id: string;
  user_id: string;
  function_name: string;
  model: string | null;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_estimate: number;
  created_at: string;
}

export interface TokenSettings {
  ai_daily_token_limit: number;
  ai_monthly_token_limit: number;
  ai_max_tokens_generate_email: number;
  ai_max_tokens_generate_outreach: number;
  ai_max_tokens_improve_email: number;
  ai_max_tokens_classify_email: number;
  ai_max_tokens_ai_assistant: number;
  ai_rate_limit_per_minute: number;
  ai_cooldown_between_calls_ms: number;
}

export interface TokenBudgetStatus {
  todayTokens: number;
  monthTokens: number;
  dailyLimit: number;
  monthlyLimit: number;
  dailyPercentage: number;
  monthlyPercentage: number;
  isNearDailyLimit: boolean;
  isNearMonthlyLimit: boolean;
  exceedsDailyLimit: boolean;
  exceedsMonthlyLimit: boolean;
}

/**
 * Log token usage to ai_token_usage table
 */
export async function logTokenUsage(
  supabase: SupabaseClient,
  userId: string,
  functionName: string,
  model: string | null,
  inputTokens: number,
  outputTokens: number,
  costEstimate: number = 0
): Promise<TokenUsageRecord | null> {
  const totalTokens = inputTokens + outputTokens;

  const { data, error } = await supabase
    .from("ai_token_usage")
    .insert({
      user_id: userId,
      function_name: functionName,
      model: model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: totalTokens,
      cost_estimate: costEstimate,
    })
    .select()
    .single();

  if (error) {
    console.error("[tokenLogger] Error logging token usage:", error);
    return null;
  }

  return data as TokenUsageRecord;
}

/**
 * Get total tokens used today (UTC midnight to now)
 */
export async function getTodayTokenUsage(supabase: SupabaseClient, userId: string): Promise<number> {
  const now = new Date();
  const startOfDay = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  const { data, error } = await supabase
    .from("ai_token_usage")
    .select("total_tokens")
    .eq("user_id", userId)
    .gte("created_at", startOfDay.toISOString());

  if (error) {
    console.error("[tokenLogger] Error getting today token usage:", error);
    return 0;
  }

  return (data || []).reduce((sum, row) => sum + (row.total_tokens || 0), 0);
}

/**
 * Get total tokens used this month (UTC)
 */
export async function getMonthTokenUsage(supabase: SupabaseClient, userId: string): Promise<number> {
  const now = new Date();
  const startOfMonth = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1);

  const { data, error } = await supabase
    .from("ai_token_usage")
    .select("total_tokens")
    .eq("user_id", userId)
    .gte("created_at", startOfMonth.toISOString());

  if (error) {
    console.error("[tokenLogger] Error getting month token usage:", error);
    return 0;
  }

  return (data || []).reduce((sum, row) => sum + (row.total_tokens || 0), 0);
}

/**
 * Get token usage breakdown by function for the given number of days
 */
export async function getUsageByFunction(
  supabase: SupabaseClient,
  userId: string,
  days: number = 7
): Promise<Record<string, number>> {
  const startDate = new Date();
  startDate.setUTCDate(startDate.getUTCDate() - days);

  const { data, error } = await supabase
    .from("ai_token_usage")
    .select("function_name, total_tokens")
    .eq("user_id", userId)
    .gte("created_at", startDate.toISOString());

  if (error) {
    console.error("[tokenLogger] Error getting usage by function:", error);
    return {};
  }

  const breakdown: Record<string, number> = {};
  for (const row of data || []) {
    breakdown[row.function_name] = (breakdown[row.function_name] || 0) + (row.total_tokens || 0);
  }

  return breakdown;
}

/**
 * Load token settings from app_settings
 */
export async function loadTokenSettings(supabase: SupabaseClient, userId: string): Promise<Partial<TokenSettings>> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("key, value")
    .eq("user_id", userId)
    .in("key", [
      "ai_daily_token_limit",
      "ai_monthly_token_limit",
      "ai_max_tokens_generate_email",
      "ai_max_tokens_generate_outreach",
      "ai_max_tokens_improve_email",
      "ai_max_tokens_classify_email",
      "ai_max_tokens_ai_assistant",
      "ai_rate_limit_per_minute",
      "ai_cooldown_between_calls_ms",
    ]);

  if (error) {
    console.error("[tokenLogger] Error loading token settings:", error);
    return {};
  }

  const settings: Partial<TokenSettings> = {};
  for (const row of data || []) {
    const numValue = parseInt(row.value || "0", 10);
    settings[row.key as keyof TokenSettings] = numValue;
  }

  return settings;
}

/**
 * Check token budget against daily/monthly limits
 * Returns status object with current usage and percentage
 */
export async function checkTokenBudget(supabase: SupabaseClient, userId: string): Promise<TokenBudgetStatus> {
  const [todayTokens, monthTokens, settings] = await Promise.all([
    getTodayTokenUsage(supabase, userId),
    getMonthTokenUsage(supabase, userId),
    loadTokenSettings(supabase, userId),
  ]);

  const dailyLimit = (settings.ai_daily_token_limit as number) || 500000;
  const monthlyLimit = (settings.ai_monthly_token_limit as number) || 10000000;

  const dailyPercentage = (todayTokens / dailyLimit) * 100;
  const monthlyPercentage = (monthTokens / monthlyLimit) * 100;

  return {
    todayTokens,
    monthTokens,
    dailyLimit,
    monthlyLimit,
    dailyPercentage,
    monthlyPercentage,
    isNearDailyLimit: dailyPercentage >= 85,
    isNearMonthlyLimit: monthlyPercentage >= 85,
    exceedsDailyLimit: todayTokens > dailyLimit,
    exceedsMonthlyLimit: monthTokens > monthlyLimit,
  };
}

/**
 * Get configurable max_tokens for a specific edge function.
 * Falls back to provided default if no setting found.
 */
export async function getMaxTokensForFunction(
  supabase: SupabaseClient,
  userId: string,
  settingKey: string,
  defaultValue: number
): Promise<number> {
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("user_id", userId)
      .eq("key", settingKey)
      .maybeSingle();
    if (data?.value) {
      const parsed = parseInt(data.value, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
  } catch {
    // fallback silently
  }
  return defaultValue;
}

/**
 * Format token count for display (e.g., "45.2K" or "1.2M")
 */
export function formatTokenCount(tokens: number): string {
  if (tokens >= 1000000) {
    return (tokens / 1000000).toFixed(1) + "M";
  }
  if (tokens >= 1000) {
    return (tokens / 1000).toFixed(1) + "K";
  }
  return tokens.toString();
}

/**
 * Get friendly function name for display
 */
export function getFunctionDisplayName(functionName: string): string {
  const nameMap: Record<string, string> = {
    generate_email: "Genera Email",
    generate_outreach: "Genera Outreach",
    improve_email: "Migliora Email",
    classify_email: "Classifica Email",
    ai_assistant: "Assistente AI",
  };
  return nameMap[functionName] || functionName;
}
