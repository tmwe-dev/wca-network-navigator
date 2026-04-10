import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { getSessionStats, type SessionStats } from "@/lib/api/costTracker";

/**
 * Refactored credits hook using React Query for caching and deduplication.
 * Replaces manual polling with proper staleTime and refetchInterval.
 */
export function useCredits() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["user-credits"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { balance: 0, totalConsumed: 0 };

      const { data: credits } = await supabase
        .from("user_credits")
        .select("balance, total_consumed")
        .eq("user_id", user.id)
        .single();

      return {
        balance: credits?.balance ?? 0,
        totalConsumed: credits?.total_consumed ?? 0,
      };
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  // Refetch on sign-in
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        queryClient.invalidateQueries({ queryKey: ["user-credits"] });
      }
    });
    return () => subscription.unsubscribe();
  }, [queryClient]);

  return {
    balance: data?.balance ?? 0,
    totalConsumed: data?.totalConsumed ?? 0,
    loading: isLoading,
    refetch: () => queryClient.invalidateQueries({ queryKey: ["user-credits"] }),
    sessionStats: getSessionStats() as SessionStats,
  };
}
