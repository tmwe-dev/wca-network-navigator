import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { getSessionStats, type SessionStats } from "@/lib/api/costTracker";
import { useAuth } from "@/providers/AuthProvider";
import { queryKeys } from "@/lib/queryKeys";

/**
 * Refactored credits hook using React Query for caching and deduplication.
 * Auth state sourced from centralized AuthProvider.
 */
export function useCredits() {
  const queryClient = useQueryClient();
  const { user, event } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.credits.all,
    queryFn: async () => {
      if (!user) return { balance: 0, totalConsumed: 0 };

      const { data: credits } = await supabase
        .from("user_credits")
        .select("balance, total_consumed")
        .eq("user_id", user.id)
        .maybeSingle();

      return {
        balance: credits?.balance ?? 0,
        totalConsumed: credits?.total_consumed ?? 0,
      };
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
    enabled: !!user,
  });

  // Refetch on sign-in
  useEffect(() => {
    if (event === "SIGNED_IN") {
      queryClient.invalidateQueries({ queryKey: queryKeys.credits.all });
    }
  }, [event, queryClient]);

  return {
    balance: data?.balance ?? 0,
    totalConsumed: data?.totalConsumed ?? 0,
    loading: isLoading,
    refetch: () => queryClient.invalidateQueries({ queryKey: queryKeys.credits.all }),
    sessionStats: getSessionStats() as SessionStats,
  };
}
