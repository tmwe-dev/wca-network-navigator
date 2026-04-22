/**
 * useTokenUsage — Real-time token usage hook with auto-refresh
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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
  const [userId, setUserId] = useState<string | null>(null);

  // Resolve current user once for both query and realtime channel
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setUserId(data.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

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

  // Subscribe to realtime changes — only when authenticated, with a unique
  // channel name per user/mount to avoid React StrictMode double-mount collisions
  // that would trigger "cannot add postgres_changes callbacks after subscribe()".
  useEffect(() => {
    if (!userId) return;

    let unsubscribed = false;
    const channelName = `token_usage_changes:${userId}:${Math.random().toString(36).slice(2, 8)}`;
    const channel = supabase.channel(channelName);

    channel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ai_token_usage",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          if (unsubscribed) return;
          queryClient.invalidateQueries({ queryKey: queryKeys.tokenUsage.all });
        }
      )
      .subscribe();

    return () => {
      unsubscribed = true;
      supabase.removeChannel(channel);
    };
  }, [queryClient, userId]);

  return query;
}
