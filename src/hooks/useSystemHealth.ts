import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

export interface HealthCheck {
  status: "healthy" | "degraded";
  checks: Record<string, "ok" | "fail">;
  timestamp: string;
}

export function useSystemHealth() {
  return useQuery<HealthCheck>({
    queryKey: queryKeys.system.health,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("health-check");
      if (error) throw error;
      return data as HealthCheck;
    },
    refetchInterval: 30000,
    staleTime: 15000,
  });
}
