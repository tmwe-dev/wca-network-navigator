/**
 * useTokenUsage — Real-time token usage hook with auto-refresh
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getTodayUsage, getMonthUsage, getTokenSettings } from "@/data/tokenUsage";
import { queryKeys } from "@/lib/queryKeys";

export interface TokenUsageData {
  todayTokens: number;
  monthTokens: number;
  dailyLimit: number;
  monthlyLimit: number;
  dailyPercentage: number;
  monthlyPercentage: number;
  isNearLimit: boolean;
  exceedsLimit: boolean;
}

export function useTokenUsage() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.tokenUsage.all,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return {
          todayTokens: 0,
          monthTokens: 0,
          dailyLimit: 500000,
          monthlyLimit: 10000000,
          dailyPercentage: 0,
          monthlyPercentage: 0,
          isNearLimit: false,
          exceedsLimit: false,
        } as TokenUsageData;
      }

      const [todayTokens, monthTokens, settings] = await Promise.all([
        getTodayUsage(user.id),
        getMonthUsage(user.id),
        getTokenSettings(user.id),
      ]);

      const dailyLimit = parseInt(settings.ai_daily_token_limit || "500000", 10);
      const monthlyLimit = parseInt(settings.ai_monthly_token_limit || "10000000", 10);

      const dailyPercentage = (todayTokens / dailyLimit) * 100;
      const monthlyPercentage = (monthTokens / monthlyLimit) * 100;

      return {
        todayTokens,
        monthTokens,
        dailyLimit,
        monthlyLimit,
        dailyPercentage,
        monthlyPercentage,
        isNearLimit: dailyPercentage >= 85 || monthlyPercentage >= 85,
        exceedsLimit: todayTokens > dailyLimit || monthTokens > monthlyLimit,
      } as TokenUsageData;
    },
    staleTime: 30_000, // 30 seconds
    refetchInterval: 30_000, // Auto-refresh every 30 seconds
  });

  // Subscribe to realtime changes
  useEffect(() => {
    const channel = supabase
      .channel("token_usage_changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ai_token_usage",
        },
        () => {
          // Invalidate and refetch on new token usage
          queryClient.invalidateQueries({ queryKey: queryKeys.tokenUsage.all });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}
