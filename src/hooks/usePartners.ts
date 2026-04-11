/**
 * React Query hooks for Partners — thin wrappers around src/data/partners.ts
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import {
  findPartners,
  findPartnersByCountry,
  getPartner,
  toggleFavorite,
  getPartnerStats,
  invalidatePartnerCache,
} from "@/data/partners";
import type { Partner, PartnerFilters, PartnerWithRelations } from "@/data/partners";

// Re-export types for backward compat
export type { Partner, PartnerFilters, PartnerWithRelations };

export function usePartners(filters?: PartnerFilters) {
  return useQuery({
    queryKey: queryKeys.partners.filtered(filters as Record<string, unknown>),
    queryFn: () => findPartners(filters),
    staleTime: 30_000,
  });
}

export function usePartnersByCountry(countryCode: string | null) {
  return useQuery({
    queryKey: ["partners-by-country", countryCode],
    queryFn: () => findPartnersByCountry(countryCode!),
    enabled: !!countryCode,
    staleTime: 30_000,
  });
}

export function usePartner(id: string) {
  return useQuery({
    queryKey: queryKeys.partner(id),
    queryFn: () => getPartner(id),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isFavorite }: { id: string; isFavorite: boolean }) => {
      await toggleFavorite(id, isFavorite);
      return { id };
    },
    onSuccess: ({ id }) => invalidatePartnerCache(qc, id),
  });
}

export function usePartnerStats() {
  return useQuery({
    queryKey: queryKeys.partnerStats,
    queryFn: getPartnerStats,
    staleTime: 60_000,
  });
}
