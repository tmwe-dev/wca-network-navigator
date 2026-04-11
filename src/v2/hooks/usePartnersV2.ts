/**
 * usePartnersV2 — STEP 6
 * Hook per lista partner con filtri e paginazione.
 */

import { useQuery } from "@tanstack/react-query";
import { fetchPartners, fetchPartnerById } from "@/v2/io/supabase/queries/partners";
import { isOk } from "@/v2/core/domain/result";
import type { Partner } from "@/v2/core/domain/entities";

export interface PartnerFilters {
  readonly searchQuery?: string;
  readonly countryCode?: string;
  readonly networkName?: string;
}

export function usePartnersV2(filters: PartnerFilters = {}) {
  return useQuery({
    queryKey: ["v2", "partners", filters],
    queryFn: async (): Promise<readonly Partner[]> => {
      const partnerResult = await fetchPartners({
        countryCode: filters.countryCode,
        networkName: filters.networkName,
        searchQuery: filters.searchQuery,
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
    queryFn: async (): Promise<Partner | null> => {
      if (!partnerId) return null;
      const partnerResult = await fetchPartnerById(partnerId);
      if (isOk(partnerResult)) return partnerResult.value;
      return null;
    },
    enabled: !!partnerId,
  });
}
