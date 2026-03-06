import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeSearchTerm } from "@/lib/sanitizeSearch";

export interface Partner {
  id: string;
  wca_id: number | null;
  company_name: string;
  country_code: string;
  country_name: string;
  city: string;
  office_type: string | null;
  address: string | null;
  phone: string | null;
  fax: string | null;
  mobile: string | null;
  emergency_phone: string | null;
  email: string | null;
  website: string | null;
  member_since: string | null;
  membership_expires: string | null;
  profile_description: string | null;
  has_branches: boolean | null;
  branch_cities: any;
  partner_type: string | null;
  is_active: boolean | null;
  is_favorite: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface PartnerFilters {
  search?: string;
  countries?: string[];
  cities?: string[];
  partnerTypes?: string[];
  services?: string[];
  certifications?: string[];
  networks?: string[];
  minRating?: number;
  minYearsMember?: number;
  hasBranches?: boolean;
  expiresWithinMonths?: number | "active";
  favorites?: boolean;
}

export function usePartners(filters?: PartnerFilters) {
  return useQuery({
    queryKey: ["partners", filters],
    queryFn: async () => {
      let query = supabase
        .from("partners")
        .select(`
          *,
          partner_services (service_category),
          partner_certifications (certification),
          partner_networks (id, network_name, expires),
          partner_contacts (id, name, title, email, direct_phone, mobile, is_primary, contact_alias)
        `)
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

      const { data, error } = await query.order("company_name").limit(2000);

      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });
}

export function usePartnersByCountry(countryCode: string | null) {
  return useQuery({
    queryKey: ["partners-by-country", countryCode],
    queryFn: async () => {
      if (!countryCode) return [];
      
      const { data, error } = await supabase
        .from("partners")
        .select(`
          *,
          partner_services (service_category),
          partner_certifications (certification)
        `)
        .eq("is_active", true)
        .eq("country_code", countryCode)
        .order("company_name")
        .limit(2000);

      if (error) throw error;
      return data;
    },
    enabled: !!countryCode,
    staleTime: 30_000,
  });
}

export function usePartner(id: string) {
  return useQuery({
    queryKey: ["partner", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partners")
        .select(`
          *,
          partner_contacts (*),
          partner_services (service_category),
          partner_certifications (certification),
          partner_networks (*),
          interactions (*),
          reminders (*)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, isFavorite }: { id: string; isFavorite: boolean }) => {
      const { error } = await supabase
        .from("partners")
        .update({ is_favorite: isFavorite })
        .eq("id", id);

      if (error) throw error;
      return { id };
    },
    onSuccess: ({ id }) => {
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      queryClient.invalidateQueries({ queryKey: ["partner", id] });
    },
  });
}

export function usePartnerStats() {
  return useQuery({
    queryKey: ["partner-stats"],
    queryFn: async () => {
      const { data: partners, error } = await supabase
        .from("partners")
        .select("id, country_code, country_name, partner_type, member_since")
        .eq("is_active", true)
        .limit(5000);

      if (error) throw error;

      const totalPartners = partners?.length || 0;
      
      const countryCounts: Record<string, { name: string; count: number }> = {};
      partners?.forEach((p) => {
        if (!countryCounts[p.country_code]) {
          countryCounts[p.country_code] = { name: p.country_name, count: 0 };
        }
        countryCounts[p.country_code].count++;
      });

      const typeCounts: Record<string, number> = {};
      partners?.forEach((p) => {
        if (p.partner_type) {
          typeCounts[p.partner_type] = (typeCounts[p.partner_type] || 0) + 1;
        }
      });

      const uniqueCountries = Object.keys(countryCounts).length;

      return {
        totalPartners,
        uniqueCountries,
        countryCounts,
        typeCounts,
      };
    },
    staleTime: 60_000,
  });
}
