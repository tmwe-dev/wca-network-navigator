/**
 * useProspectsV2 — RA Prospects
 */
import { useQuery } from "@tanstack/react-query";
import { fetchProspects, fetchProspectsByRegion } from "@/v2/io/supabase/queries/prospects";
import { isOk } from "@/v2/core/domain/result";
import type { Prospect } from "@/v2/core/domain/entities";

export function useProspectsV2(region?: string) {
  return useQuery({
    queryKey: ["v2", "prospects", region ?? "all"],
    queryFn: async (): Promise<readonly Prospect[]> => {
      const result = region
        ? await fetchProspectsByRegion(region)
        : await fetchProspects();
      return isOk(result) ? result.value : [];
    },
  });
}
