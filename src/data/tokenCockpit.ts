/**
 * DAL — Token Cockpit (ai_prompt_log + limiti token in app_settings).
 * Estratto dai componenti src/components/token-cockpit/**: semantica invariata
 * (nessun filtro aggiunto, errori restituiti al chiamante).
 */
import { supabase } from "@/integrations/supabase/client";

export interface TokenTotalRow {
  tokens_total: number | null;
}

export interface TokenLimitSettingRow {
  key: string;
  value: string | null;
}

export interface TokenUsageLogRow {
  id: string;
  function_name: string | null;
  model: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  tokens_total: number | null;
  cost_usd: number | null;
  created_at: string | null;
}

export interface TokenSeriesRow {
  tokens_total: number | null;
  created_at: string | null;
}

export interface TokenByFunctionRow {
  function_name: string | null;
  tokens_total: number | null;
}

export async function findTokenTotalsSince(sinceIso: string): Promise<TokenTotalRow[]> {
  const { data } = await supabase.from("ai_prompt_log").select("tokens_total").gte("created_at", sinceIso);
  return data ?? [];
}

export async function findTokenLimitSettings(userId: string): Promise<TokenLimitSettingRow[]> {
  const { data } = await supabase
    .from("app_settings")
    .select("key, value")
    .eq("user_id", userId)
    .in("key", ["ai_daily_token_limit", "ai_monthly_token_limit"]);
  return data ?? [];
}

export async function findRecentTokenUsageRows(
  limit: number,
): Promise<{ data: TokenUsageLogRow[] | null; error: { message: string } | null }> {
  const { data, error } = await supabase
    .from("ai_prompt_log")
    .select("id, function_name, model, tokens_in, tokens_out, tokens_total, cost_usd, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return { data, error };
}

export async function findTokenSeriesSince(
  sinceIso: string,
): Promise<{ data: TokenSeriesRow[] | null; error: { message: string } | null }> {
  const { data, error } = await supabase
    .from("ai_prompt_log")
    .select("tokens_total, created_at")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: true });
  return { data, error };
}

export async function findTokensByFunctionSince(
  sinceIso: string,
): Promise<{ data: TokenByFunctionRow[] | null; error: { message: string } | null }> {
  const { data, error } = await supabase
    .from("ai_prompt_log")
    .select("function_name, tokens_total")
    .gte("created_at", sinceIso);
  return { data, error };
}
