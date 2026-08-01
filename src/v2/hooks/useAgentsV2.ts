/**
 * useAgentsV2 — STEP 8
 * Hook for agent list and detail.
 */

import { useQuery } from "@tanstack/react-query";
import { fetchAgents } from "@/v2/io/supabase/queries/agents";
import { isOk } from "@/v2/core/domain/result";
import type { Agent } from "@/v2/core/domain/entities";
import { queryKeys } from "@/lib/queryKeys";

export function useAgentsV2() {
  return useQuery({
    queryKey: queryKeys.v2.agents(),
    queryFn: async (): Promise<readonly Agent[]> => {
      const agentResult = await fetchAgents();
      if (isOk(agentResult)) return agentResult.value;
      return [];
    },
  });
}
