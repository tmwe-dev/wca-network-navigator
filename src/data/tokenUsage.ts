/**
 * DAL — token usage and settings
 */
import { supabase } from "@/integrations/supabase/client";

import { createLogger } from "@/lib/log";
const log = createLogger("tokenUsage");

export interface TokenUsageRow {
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

export interface TokenSettingsRecord {
  key: string;
  value: string;
}

/**
 * Get total tokens used today
 */
export async function getTodayUsage(userId: string): Promise<number> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const { data, error } = await supabase
    .from("ai_token_usage")
    .select("total_tokens")
    .eq("user_id", userId)
    .gte("created_at", startOfDay.toISOString());

  if (error) {
    log.error("[tokenUsage] Error getting today usage:", error);
    return 0;
  }

  return (data || []).reduce((sum, row) => sum + (row.total_tokens || 0), 0);
}

/**
 * Get total tokens used this month
 */
export async function getMonthUsage(userId: string): Promise<number> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const { data, error } = await supabase
    .from("ai_token_usage")
    .select("total_tokens")
    .eq("user_id", userId)
    .gte("created_at", startOfMonth.toISOString());

  if (error) {
    log.error("[tokenUsage] Error getting month usage:", error);
    return 0;
  }

  return (data || []).reduce((sum, row) => sum + (row.total_tokens || 0), 0);
}

/**
 * Get token usage breakdown by function for the given number of days
 */
export async function getUsageByFunction(userId: string, days: number = 7): Promise<Record<string, number>> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await supabase
    .from("ai_token_usage")
    .select("function_name, total_tokens")
    .eq("user_id", userId)
    .gte("created_at", startDate.toISOString());

  if (error) {
    log.error("[tokenUsage] Error getting usage by function:", error);
    return {};
  }

  const breakdown: Record<string, number> = {};
  for (const row of data || []) {
    breakdown[row.function_name] = (breakdown[row.function_name] || 0) + (row.total_tokens || 0);
  }

  return breakdown;
}

/**
 * Get all token-related settings for a user
 */
export async function getTokenSettings(userId: string): Promise<Record<string, string>> {
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
    log.error("[tokenUsage] Error getting token settings:", error);
    return {};
  }

  const settings: Record<string, string> = {};
  for (const row of data || []) {
    settings[row.key] = row.value ?? "";
  }

  return settings;
}

/**
 * Update a token setting
 */
export async function updateTokenSetting(userId: string, key: string, value: string): Promise<void> {
  const { data: existing } = await supabase
    .from("app_settings")
    .select("id")
    .eq("key", key)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("app_settings")
      .update({ value })
      .eq("key", key)
      .eq("user_id", userId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("app_settings")
      .insert({ key, value, user_id: userId });
    if (error) throw error;
  }
}

/**
 * Format token count for display
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
