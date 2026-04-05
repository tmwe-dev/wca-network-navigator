/**
 * usePartnersPaginated — Paginated partner loading for Network page
 * Uses useInfiniteQuery to load 50 partners at a time with infinite scroll
 */
import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeSearchTerm } from "@/lib/sanitizeSearch";
import type { PartnerFilters } from "./usePartners";

const PAGE_SIZE = 50;

export function usePartnersPaginated(filters?: PartnerFilters) {
  return useInfiniteQuery({
    queryKey: ["partners-paginated", filters],
    queryFn: async ({ pageParam = 0 }) => {
      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("partners")
        .select(`
          id, company_name, company_alias, country_code, city, email, phone, mobile,
          office_type, is_active, is_favorite, rating, member_since, wca_id,
          raw_profile_html, enrichment_data, partner_type,
          partner_contacts (id, name, title, email, direct_phone, mobile, is_primary, contact_alias),
          partner_networks (id, network_name, expires)
        `, { count: "exact" })
        .eq("is_active", true);

      if (filters?.search) {
        const s = sanitizeSearchTerm(filters.search);
        if (s) query = query.ilike("company_name", `%${s}%`);
      }

      if (filters?.countries && filters.countries.length > 0) {
        query = query.in("country_code", filters.countries);
      }

      if (filters?.cities && filters.cities.length > 0) {
        query = query.in("city", filters.cities);
      }

      if (filters?.partnerTypes && filters.partnerTypes.length > 0) {
        query = query.in("partner_type", filters.partnerTypes as any);
      }

      if (filters?.favorites) {
        query = query.eq("is_favorite", true);
      }

      const { data, error, count } = await query
        .order("company_name")
        .range(from, to);

      if (error) throw error;

      return {
        partners: data || [],
        total: count || 0,
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
