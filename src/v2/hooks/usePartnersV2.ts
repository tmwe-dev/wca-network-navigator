/**
 * usePartnersV2 — Infinite scroll hook with server-side filtering & pagination.
 */
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchPartnersPaginated, fetchPartnerById, type PartnerQueryFilters } from "@/v2/io/supabase/queries/partners";
import { updatePartner } from "@/v2/io/supabase/mutations/partners";
import { isOk } from "@/v2/core/domain/result";
import type { PartnerV2 } from "@/v2/core/domain/partner-entity";

const PAGE_SIZE = 50;

export interface PartnerFilters {
  readonly searchQuery?: string;
  readonly countryCode?: string;
  readonly city?: string;
  readonly partnerType?: string;
  readonly favorites?: boolean;
  readonly quality?: "with_email" | "with_phone" | "with_profile" | "no_email";
  readonly sort?: "name" | "rating" | "recent";
}

function filtersToQuery(f: PartnerFilters): PartnerQueryFilters {
  return {
    search: f.searchQuery,
    countryCode: f.countryCode,
    city: f.city,
    partnerType: f.partnerType,
    favorites: f.favorites,
    quality: f.quality,
    sort: f.sort,
    limit: PAGE_SIZE,
  };
}

export function usePartnersInfinite(filters: PartnerFilters = {}) {
  return useInfiniteQuery({
    queryKey: ["v2", "partners-infinite", filters],
    queryFn: async ({ pageParam = 0 }) => {
      const result = await fetchPartnersPaginated({
        ...filtersToQuery(filters),
        offset: pageParam * PAGE_SIZE,
      });

      if (isOk(result)) return result.value;
      return { partners: [] as PartnerV2[], total: 0, hasMore: false };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      lastPage.hasMore ? lastPageParam + 1 : undefined,
    staleTime: 30_000,
  });
}

/** Simple non-paginated (for backward compat) */
export function usePartnersV2(filters: PartnerFilters = {}) {
  return useQuery({
    queryKey: ["v2", "partners", filters],
    queryFn: async (): Promise<readonly PartnerV2[]> => {
      const result = await fetchPartnersPaginated({
        ...filtersToQuery(filters),
        limit: 500,
      });
      if (isOk(result)) return result.value.partners;
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

export function useToggleFavoriteV2() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isFavorite }: { id: string; isFavorite: boolean }) => {
      const result = await updatePartner(id, { is_favorite: isFavorite });
      if (result._tag === "Err") throw new Error(result.error.message);
      return result.value;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["v2", "partners"] });
      qc.invalidateQueries({ queryKey: ["v2", "partners-infinite"] });
      qc.invalidateQueries({ queryKey: ["v2", "partner"] });
    },
  });
}
