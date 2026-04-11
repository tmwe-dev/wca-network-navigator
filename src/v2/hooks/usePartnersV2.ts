/**
 * usePartnersV2 — Hook per lista partner con filtri e paginazione.
 */
import { useQuery } from "@tanstack/react-query";
import { fetchPartners, fetchPartnerById } from "@/v2/io/supabase/queries/partners";
import { isOk } from "@/v2/core/domain/result";
import type { PartnerV2 } from "@/v2/core/domain/partner-entity";

export interface PartnerFilters {
  readonly searchQuery?: string;
  readonly countryCode?: string;
  readonly networkName?: string;
}

export function usePartnersV2(filters: PartnerFilters = {}) {
  return useQuery({
    queryKey: ["v2", "partners", filters],
    queryFn: async (): Promise<readonly PartnerV2[]> => {
      const partnerResult = await fetchPartners({
        countryCode: filters.countryCode,
        search: filters.searchQuery,
        limit: 500,
      });

      if (isOk(partnerResult)) return partnerResult.value;
      return [];
    },
  });
}

export function usePartnerDetail(partnerId: string | null) {
  return useQuery({
    queryKey: ["v2", "partner", partnerId],
    queryFn: async (): Promise<PartnerV2 | null> => {
      if (!partnerId) return null;
      const partnerResult = await fetchPartnerById(partnerId);
      if (isOk(partnerResult)) return partnerResult.value;
      return null;
    },
    enabled: !!partnerId,
  });
}
