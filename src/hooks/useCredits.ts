import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CreditsState {
  balance: number;
  totalConsumed: number;
  loading: boolean;
}

export function useCredits() {
  const [state, setState] = useState<CreditsState>({
    balance: 0,
    totalConsumed: 0,
    loading: true,
  });

  const fetchCredits = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("user_credits")
        .select("balance, total_consumed")
        .eq("user_id", user.id)
        .single();

      if (data) {
        setState({
          balance: data.balance,
          totalConsumed: data.total_consumed,
          loading: false,
        });
      }
    } catch {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    fetchCredits();

    // Poll every 30s for near-realtime updates
    const interval = setInterval(fetchCredits, 30_000);

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") fetchCredits();
    });

    return () => {
      clearInterval(interval);
      subscription.unsubscribe();
    };
  }, [fetchCredits]);

  return { ...state, refetch: fetchCredits };
}
