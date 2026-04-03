import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useEmailCount(enabled: boolean) {
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
    enabled,
    refetchInterval: enabled ? 3000 : false,
  });
}
