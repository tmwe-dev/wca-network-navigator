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
import { supabase } from "@/integrations/supabase/client";
import { sanitizeSearchTerm } from "@/lib/sanitizeSearch";
import type { PartnerFilters } from "./usePartners";

const PAGE_SIZE = 50;

export interface PaginatedFilters extends PartnerFilters {
  quality?: string;
  hideHolding?: boolean;
  sort?: string;
}

export function usePartnersPaginated(filters?: PaginatedFilters) {
  return useInfiniteQuery({
    queryKey: ["partners-paginated", filters],
    queryFn: async ({ pageParam = 0 }) => {
      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      // Lightweight select — NO joins for list performance
      const selectFields = `id, company_name, company_alias, country_code, city, email, phone, mobile,
           office_type, is_active, is_favorite, rating, member_since, wca_id,
           raw_profile_html, enrichment_data, partner_type, lead_status`;

      let query = supabase
        .from("partners")
        .select(selectFields, { count: "exact" })
        .eq("is_active", true);

      // ── Text search ──
      if (filters?.search) {
        const s = sanitizeSearchTerm(filters.search);
        if (s) query = query.ilike("company_name", `%${s}%`);
      }

      // ── Country filter ──
      if (filters?.countries && filters.countries.length > 0) {
        query = query.in("country_code", filters.countries);
      }

      // ── City filter ──
      if (filters?.cities && filters.cities.length > 0) {
        query = query.in("city", filters.cities);
      }

      // ── Partner type filter ──
      if (filters?.partnerTypes && filters.partnerTypes.length > 0) {
        query = query.in("partner_type", filters.partnerTypes as string[]);
      }

      // ── Favorites ──
      if (filters?.favorites) {
        query = query.eq("is_favorite", true);
      }

      // ── Hide holding (lead_status not 'new') ──
      if (filters?.hideHolding) {
        query = query.or("lead_status.is.null,lead_status.eq.new");
      }

      // ── Quality filters (server-side, no joins needed) ──
      if (filters?.quality === "with_email") {
        query = query.not("email", "is", null);
      }
      if (filters?.quality === "with_phone") {
        query = query.or("phone.not.is.null,mobile.not.is.null");
      }
      if (filters?.quality === "with_profile") {
        query = query.not("raw_profile_html", "is", null);
      }
      if (filters?.quality === "no_email") {
        query = query.is("email", null);
      }

      // ── Server-side sorting ──
      if (filters?.sort === "rating") {
        query = query.order("rating", { ascending: false, nullsFirst: false }).order("company_name");
      } else if (filters?.sort === "recent") {
        query = query.order("member_since", { ascending: false, nullsFirst: false }).order("company_name");
      } else {
        query = query.order("company_name");
      }

      const { data, error, count } = await query
        .range(from, to);

      if (error) throw error;

      return {
        partners: data || [],
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
