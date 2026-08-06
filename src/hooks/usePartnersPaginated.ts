/**
 * usePartnersPaginated — Paginated partner loading for Network page
 * Uses useInfiniteQuery to load 50 partners at a time with infinite scroll
 *
 * Performance strategy:
 * - NO joins (partner_contacts/partner_networks) — loaded on demand in detail
 * - Always count:exact (fast without joins)
 * - Quality/holding filters pushed to SQL via EXISTS subqueries
 */
import { useInfiniteQuery } from "@tanstack/react-query";
import { findPartnersPaginated } from "@/data/partners";
import type { PartnerFilters } from "./usePartners";
import { queryKeys } from "@/lib/queryKeys";

const PAGE_SIZE = 50;

export interface PaginatedFilters extends PartnerFilters {
  quality?: string;
  hideHolding?: boolean;
  sort?: string;
}

export function usePartnersPaginated(filters?: PaginatedFilters) {
  return useInfiniteQuery({
    queryKey: queryKeys.partners.paginated(filters),
    queryFn: async ({ pageParam = 0 }) => {
      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { partners, total } = await findPartnersPaginated(filters, from, to);

      return {
        partners,
        total,
        page: pageParam,
        hasMore: (partners?.length || 0) === PAGE_SIZE,
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    staleTime: 30_000,
  });
}
