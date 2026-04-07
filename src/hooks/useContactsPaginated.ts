/**
 * useContactsPaginated — Infinite scroll for CRM contacts
 * Same pattern as usePartnersPaginated: loads 50 at a time, no heavy queries
 */
import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeSearchTerm } from "@/lib/sanitizeSearch";

const PAGE_SIZE = 50;

export interface ContactPaginatedFilters {
  search?: string;
  countries?: string[];
  origins?: string[];
  cities?: string[];
  leadStatus?: string;
  channel?: string;
  quality?: string;
  wcaMatch?: "matched" | "unmatched" | "all";
  holdingPattern?: "out" | "in" | "all";
  importLogId?: string;
  sort?: string;
}

export function useContactsPaginated(filters?: ContactPaginatedFilters) {
  return useInfiniteQuery({
    queryKey: ["contacts-paginated", filters],
    queryFn: async ({ pageParam = 0 }) => {
      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("imported_contacts")
        .select("*", { count: "exact" });

      // Quality baseline: at least one useful field
      query = query.or("company_name.not.is.null,name.not.is.null,email.not.is.null");

      // Search
      if (filters?.search) {
        const s = sanitizeSearchTerm(filters.search);
        if (s) {
          query = query.or(
            `company_name.ilike.%${s}%,company_alias.ilike.%${s}%,name.ilike.%${s}%,email.ilike.%${s}%,city.ilike.%${s}%,country.ilike.%${s}%,position.ilike.%${s}%,origin.ilike.%${s}%,phone.ilike.%${s}%,mobile.ilike.%${s}%`
          );
        }
      }

      // Countries
      if (filters?.countries && filters.countries.length > 0) {
        query = query.in("country", filters.countries);
      }

      // Origins
      if (filters?.origins && filters.origins.length > 0) {
        query = query.in("origin", filters.origins);
      }

      // Lead status
      if (filters?.leadStatus) {
        query = query.eq("lead_status", filters.leadStatus);
      }

      // Import log
      if (filters?.importLogId) {
        query = query.eq("import_log_id", filters.importLogId);
      }

      // Holding pattern
      if (filters?.holdingPattern === "out") query = query.eq("interaction_count", 0);
      else if (filters?.holdingPattern === "in") query = query.gt("interaction_count", 0);

      // Channel
      if (filters?.channel === "with_email") query = query.not("email", "is", null);
      else if (filters?.channel === "with_phone") query = query.not("phone", "is", null);

      // Quality
      if (filters?.quality === "enriched") query = query.not("deep_search_at", "is", null);
      else if (filters?.quality === "not_enriched") query = query.is("deep_search_at", null);
      else if (filters?.quality === "with_alias") query = query.not("company_alias", "is", null);
      else if (filters?.quality === "no_alias") query = query.is("company_alias", null);

      // WCA match
      if (filters?.wcaMatch === "matched") query = query.not("wca_partner_id", "is", null);
      else if (filters?.wcaMatch === "unmatched") query = query.is("wca_partner_id", null);

      // Sorting
      if (filters?.sort === "name") {
        query = query.order("name", { ascending: true, nullsFirst: false }).order("company_name");
      } else if (filters?.sort === "recent") {
        query = query.order("created_at", { ascending: false });
      } else {
        query = query.order("company_name", { ascending: true, nullsFirst: false }).order("name");
      }

      const { data, error, count } = await query.range(from, to);
      if (error) throw error;

      return {
        contacts: data || [],
        total: count ?? 0,
        page: pageParam,
        hasMore: (data?.length || 0) === PAGE_SIZE,
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    staleTime: 30_000,
  });
}
