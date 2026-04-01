import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns a Set of source IDs that already have an activity created today.
 * Covers both partner and contact source types.
 */
export function useWorkedToday() {
  const { data: workedIds = new Set<string>(), isLoading } = useQuery({
    queryKey: ["worked-today"],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from("activities")
        .select("source_id, source_type")
        .in("source_type", ["partner", "contact", "prospect"])
        .gte("created_at", today.toISOString());

      if (error) throw error;
      return new Set((data || []).map((r) => r.source_id));
    },
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  return { workedIds, isLoading };
}
