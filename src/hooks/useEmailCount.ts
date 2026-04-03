import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Always returns the total email count from database.
 * When isSyncing=true, polls every 3s for live updates.
 */
export function useEmailCount(isSyncing = false) {
  return useQuery({
    queryKey: ["email-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("channel_messages")
        .select("*", { count: "exact", head: true })
        .eq("channel", "email");
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: isSyncing ? 3000 : 30000,
  });
}
