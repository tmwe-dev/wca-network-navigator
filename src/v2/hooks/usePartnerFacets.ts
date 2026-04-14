/**
 * usePartnerFacets — Available countries for filter dropdowns
 */
import { useQuery } from "@tanstack/react-query";
import { fetchPartnerFacets, type PartnerFacets } from "@/v2/io/supabase/queries/partner-facets";
import { isOk } from "@/v2/core/domain/result";
import { queryKeys } from "@/lib/queryKeys";

const EMPTY: PartnerFacets = { countries: [], cities: [], partnerTypes: [], totalCount: 0 };

export function usePartnerFacets() {
  return useQuery({
    queryKey: queryKeys.v2.partnerFacets(),
    queryFn: async (): Promise<PartnerFacets> => {
      const result = await fetchPartnerFacets();
      if (isOk(result)) return result.value;
      return EMPTY;
    },
    staleTime: 5 * 60_000,
  });
}
