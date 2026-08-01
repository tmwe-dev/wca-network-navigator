/**
 * useTokenCockpitData — Hook layer per il Token Cockpit.
 *
 * I componenti UI non possono importare `src/data/*` (regola no-restricted-imports):
 * qui vivono le query React Query del cockpit token, spostate senza alcuna
 * modifica di queryKey, enabled, mapping dati o semantica di errore/loading.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  findTokenTotalsSince,
  findTokenLimitSettings,
  findTokensByFunctionSince,
  findTokenSeriesSince,
  findRecentTokenUsageRows,
} from "@/data/tokenCockpit";
import { findPromptLogTokens, getTokenSettings } from "@/data/tokenUsage";
import { getFunctionDisplayName } from "@/lib/tokenFormat";
import { createLogger } from "@/lib/log";

const log = createLogger("useTokenCockpitData");

export interface GaugeData {
  daily: { used: number; limit: number; percentage: number };
  monthly: { used: number; limit: number; percentage: number };
}

export interface TrendData {
  today: number;
  yesterday: number;
  thisWeek: number;
  lastWeek: number;
}

export interface ChartData {
  date: string;
  tokens: number;
  displayDate: string;
}

export interface PieData {
  name: string;
  value: number;
  displayValue: string;
}

export interface UsageRow {
  id: string;
  function_name: string;
  model: string | null;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_estimate: number;
  created_at: string;
}

export interface TokenStats {
  today: number;
  month: number;
  dailyLimit: number;
  monthlyLimit: number;
}

export function useTokenStats(userId: string | undefined) {
  return useQuery({
    queryKey: ["tokenUsage", "stats", userId],
    queryFn: async (): Promise<TokenStats> => {
      if (!userId) {
        return { today: 0, month: 0, dailyLimit: 500000, monthlyLimit: 10000000 };
      }

      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [dailyData, monthlyData, settings] = await Promise.all([
        findPromptLogTokens({ since: startOfDay.toISOString() }),
        findPromptLogTokens({ since: startOfMonth.toISOString() }),
        getTokenSettings(userId),
      ]);

      const today = (dailyData || []).reduce((sum, row) => sum + (row.tokens_total || 0), 0);
      const month = (monthlyData || []).reduce((sum, row) => sum + (row.tokens_total || 0), 0);

      const dailyLimit = parseInt(settings["ai_daily_token_limit"] || "500000", 10);
      const monthlyLimit = parseInt(settings["ai_monthly_token_limit"] || "10000000", 10);

      return { today, month, dailyLimit, monthlyLimit };
    },
    enabled: !!userId,
  });
}

/** Utente corrente — stessa queryKey ["user"] usata dai componenti originali. */
export function useTokenCockpitUser() {
  return useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession().then((r) => ({ data: { user: r.data.session?.user ?? null } }));
      return data.user;
    },
  });
}

export function useTokenGauge(userId: string | undefined) {
  return useQuery({
    queryKey: ["tokenUsage", "gauge", userId],
    queryFn: async (): Promise<GaugeData> => {
      if (!userId) {
        return {
          daily: { used: 0, limit: 500000, percentage: 0 },
          monthly: { used: 0, limit: 10000000, percentage: 0 },
        };
      }

      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [dailyData, monthlyData, settingsData] = await Promise.all([
        findTokenTotalsSince(startOfDay.toISOString()),
        findTokenTotalsSince(startOfMonth.toISOString()),
        findTokenLimitSettings(userId),
      ]);

      const dailyUsed = (dailyData || []).reduce((sum, row) => sum + (row.tokens_total || 0), 0);
      const monthlyUsed = (monthlyData || []).reduce((sum, row) => sum + (row.tokens_total || 0), 0);

      const settings = (settingsData || []).reduce((acc, row) => {
        acc[row.key] = row.value ?? "";
        return acc;
      }, {} as Record<string, string>);

      const dailyLimit = parseInt(settings["ai_daily_token_limit"] || "500000", 10);
      const monthlyLimit = parseInt(settings["ai_monthly_token_limit"] || "10000000", 10);

      return {
        daily: { used: dailyUsed, limit: dailyLimit, percentage: (dailyUsed / dailyLimit) * 100 },
        monthly: { used: monthlyUsed, limit: monthlyLimit, percentage: (monthlyUsed / monthlyLimit) * 100 },
      };
    },
    enabled: !!userId,
  });
}

export function useTokenByFunction(userId: string | undefined) {
  return useQuery({
    queryKey: ["tokenUsage", "byFunction", userId],
    queryFn: async (): Promise<PieData[]> => {
      if (!userId) return [];

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data, error } = await findTokensByFunctionSince(sevenDaysAgo.toISOString());

      if (error) {
        log.error("Error fetching function breakdown:", { error: error });
        return [];
      }

      const functionData: Record<string, number> = {};
      for (const row of data || []) {
        const rawFn = row.function_name || "Altro";
        const fn = rawFn.split(":")[0];
        functionData[fn] = (functionData[fn] || 0) + (row.tokens_total || 0);
      }

      return Object.entries(functionData)
        .map(([fn, tokens]) => ({
          name: getFunctionDisplayName(fn),
          value: tokens,
          displayValue: tokens >= 1000000 ? (tokens / 1000000).toFixed(1) + "M" : (tokens / 1000).toFixed(1) + "K",
        }))
        .sort((a, b) => b.value - a.value);
    },
    enabled: !!userId,
  });
}

export function useTokenTrend(userId: string | undefined) {
  return useQuery({
    queryKey: ["tokenUsage", "trend", userId],
    queryFn: async (): Promise<TrendData> => {
      if (!userId) {
        return { today: 0, yesterday: 0, thisWeek: 0, lastWeek: 0 };
      }

      const now = new Date();

      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfYesterday = new Date(startOfToday);
      startOfYesterday.setDate(startOfYesterday.getDate() - 1);
      const endOfYesterday = new Date(startOfToday);

      const startOfThisWeek = new Date(startOfToday);
      startOfThisWeek.setDate(startOfThisWeek.getDate() - startOfThisWeek.getDay() + 1);

      const startOfLastWeek = new Date(startOfThisWeek);
      startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
      const endOfLastWeek = new Date(startOfLastWeek);
      endOfLastWeek.setDate(endOfLastWeek.getDate() + 7);

      const [todayRes, yesterdayRes, thisWeekRes, lastWeekRes] = await Promise.all([
        findPromptLogTokens({ since: startOfToday.toISOString() }),
        findPromptLogTokens({
          since: startOfYesterday.toISOString(),
          before: endOfYesterday.toISOString(),
        }),
        findPromptLogTokens({ since: startOfThisWeek.toISOString() }),
        findPromptLogTokens({
          since: startOfLastWeek.toISOString(),
          before: endOfLastWeek.toISOString(),
        }),
      ]);

      const today = todayRes.reduce((sum, row) => sum + (row.tokens_total || 0), 0);
      const yesterday = yesterdayRes.reduce((sum, row) => sum + (row.tokens_total || 0), 0);
      const thisWeek = thisWeekRes.reduce((sum, row) => sum + (row.tokens_total || 0), 0);
      const lastWeek = lastWeekRes.reduce((sum, row) => sum + (row.tokens_total || 0), 0);

      return { today, yesterday, thisWeek, lastWeek };
    },
    enabled: !!userId,
  });
}

export function useTokenSeries(userId: string | undefined) {
  return useQuery({
    queryKey: ["tokenUsage", "chart", userId],
    queryFn: async (): Promise<ChartData[]> => {
      if (!userId) return [];

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await findTokenSeriesSince(thirtyDaysAgo.toISOString());

      if (error) {
        log.error("Error fetching chart data:", { error: error });
        return [];
      }

      const dailyData: Record<string, number> = {};
      for (const row of data || []) {
        const date = new Date(row.created_at ?? "").toLocaleDateString("it-IT");
        dailyData[date] = (dailyData[date] || 0) + (row.tokens_total || 0);
      }

      return Object.entries(dailyData)
        .map(([date, tokens]) => ({
          date,
          tokens,
          displayDate: date,
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    },
    enabled: !!userId,
  });
}

export function useRecentTokenUsage(userId: string | undefined) {
  return useQuery({
    queryKey: ["tokenUsage", "table", userId],
    queryFn: async (): Promise<UsageRow[]> => {
      if (!userId) return [];

      const { data, error } = await findRecentTokenUsageRows(20);

      if (error) {
        log.error("Error fetching table data:", { error: error });
        return [];
      }

      // Mapping identico all'originale (incluso il cast: le colonne nullable
      // erano già trattate come stringhe dalla UI prima di questo spostamento).
      return (data || []).map((r) => ({
        id: r.id,
        function_name: r.function_name,
        model: r.model,
        input_tokens: r.tokens_in ?? 0,
        output_tokens: r.tokens_out ?? 0,
        total_tokens: r.tokens_total ?? 0,
        cost_estimate: Number(r.cost_usd ?? 0),
        created_at: r.created_at,
      })) as UsageRow[];
    },
    enabled: !!userId,
  });
}
