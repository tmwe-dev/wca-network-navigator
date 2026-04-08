/**
 * useEntityPaginated — Generic factory for paginated entity lists.
 *
 * Replaces the duplication between usePartnersPaginated and useContactsPaginated.
 * Both hooks remain functional; new pages can use this factory directly,
 * and existing hooks can migrate at their own pace.
 *
 * Usage:
 *   const usePartners = makeEntityPaginated<Partner, MyFilters>({
 *     table: "partners",
 *     pageSize: 50,
 *     selectFields: "id, company_name, country_code, city, rating",
 *     baseQuery: (q) => q.eq("is_active", true),
 *     applyFilters: (q, f) => {
 *       if (f.search) q = q.ilike("company_name", `%${f.search}%`);
 *       if (f.countries?.length) q = q.in("country_code", f.countries);
 *       return q;
 *     },
 *     applySort: (q, sort) => sort === "name"
 *       ? q.order("company_name") : q.order("created_at", { ascending: false }),
 *   });
 *
 *   const { data, fetchNextPage, hasNextPage } = usePartners(filters);
 */
import { useInfiniteQuery, type UseInfiniteQueryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type PostgrestQB = any; // supabase types are messy with chaining

export interface EntityPaginatedConfig<TFilters> {
  /** Logical name used as part of the queryKey + telemetry */
  entity: string;
  /** Supabase table name */
  table: string;
  /** Comma-separated select fields, kept lightweight (no joins) */
  selectFields: string;
  /** Page size, default 50 */
  pageSize?: number;
  /** Stale time in ms, default 30s */
  staleTime?: number;
  /** Base query mutation (e.g. only active rows) */
  baseQuery?: (q: PostgrestQB) => PostgrestQB;
  /** Apply filters from the filters object */
  applyFilters?: (q: PostgrestQB, f: TFilters) => PostgrestQB;
  /** Apply sort */
  applySort?: (q: PostgrestQB, sort: string | undefined) => PostgrestQB;
  /** Whether to use exact count (default true) */
  exactCount?: boolean;
}

export interface PaginatedPage<TRow> {
  rows: TRow[];
  page: number;
  pageSize: number;
  total: number | null;
  hasMore: boolean;
}

export function makeEntityPaginated<TRow, TFilters extends { sort?: string }>(
  config: EntityPaginatedConfig<TFilters>
) {
  const PAGE_SIZE = config.pageSize ?? 50;

  return function useEntityPaginatedHook(
    filters?: TFilters,
    options?: Partial<UseInfiniteQueryOptions<PaginatedPage<TRow>>>
  ) {
    return useInfiniteQuery<PaginatedPage<TRow>>({
      queryKey: [`${config.entity}-paginated`, filters ?? null],
      initialPageParam: 0,
      queryFn: async ({ pageParam = 0 }) => {
        const page = pageParam as number;
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        let q: PostgrestQB = supabase
          .from(config.table)
          .select(config.selectFields, {
            count: config.exactCount === false ? "estimated" : "exact",
          });

        if (config.baseQuery) q = config.baseQuery(q);
        if (config.applyFilters && filters) q = config.applyFilters(q, filters);
        if (config.applySort) q = config.applySort(q, filters?.sort);

        q = q.range(from, to);

        const { data, error, count } = await q;
        if (error) throw error;

        return {
          rows: (data as TRow[]) ?? [],
          page,
          pageSize: PAGE_SIZE,
          total: count ?? null,
          hasMore: (data?.length ?? 0) === PAGE_SIZE,
        };
      },
      getNextPageParam: (lastPage) =>
        lastPage.hasMore ? lastPage.page + 1 : undefined,
      staleTime: config.staleTime ?? 30_000,
      ...options,
    });
  };
}
