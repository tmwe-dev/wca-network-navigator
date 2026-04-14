/**
 * useContactsPaginated — Infinite scroll for CRM contacts
 * Delegates all queries to the DAL layer.
 */
import { useInfiniteQuery } from "@tanstack/react-query";
import { findContactsPaginated, type ContactPaginatedFilters } from "@/data/contacts";

export type { ContactPaginatedFilters } from "@/data/contacts";

const PAGE_SIZE = 50;

export function useContactsPaginated(filters?: ContactPaginatedFilters) {
  return useInfiniteQuery({
    queryKey: ["contacts-paginated", filters],
    queryFn: async ({ pageParam = 0 }) => {
      return findContactsPaginated(filters ?? {}, pageParam, PAGE_SIZE);
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    staleTime: 30_000,
  });
}
