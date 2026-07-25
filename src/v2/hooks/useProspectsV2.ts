/**
 * useProspectsV2 — RA Prospects
 */
import { useQuery } from "@tanstack/react-query";
import { fetchProspects, fetchProspectsByRegion } from "@/v2/io/supabase/queries/prospects";
import { isOk } from "@/v2/core/domain/result";
import type { Prospect } from "@/v2/core/domain/entities";
import { queryKeys } from "@/lib/queryKeys";

export function useProspectsV2(region?: string) {
  return useQuery({
    queryKey: queryKeys.v2.prospects(region ?? "all"),
    queryFn: async (): Promise<readonly Prospect[]> => {
      const result = region
        ? await fetchProspectsByRegion(region)
        : await fetchProspects();
      return isOk(result) ? result.value : [];
    },
  });
}
