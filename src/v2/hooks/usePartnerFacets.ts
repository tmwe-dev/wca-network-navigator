/**
 * usePartnerFacets — Available countries, networks for filter dropdowns
 */
import { useQuery } from "@tanstack/react-query";
import { fetchPartnerFacets, type PartnerFacets } from "@/v2/io/supabase/queries/partner-facets";
import { isOk } from "@/v2/core/domain/result";

const EMPTY: PartnerFacets = { countries: [], networks: [], totalCount: 0 };

export function usePartnerFacets() {
  return useQuery({
    queryKey: ["v2", "partner-facets"],
    queryFn: async (): Promise<PartnerFacets> => {
      const result = await fetchPartnerFacets();
      if (isOk(result)) return result.value;
      return EMPTY;
    },
    staleTime: 5 * 60_000, // 5 min cache
  });
}
