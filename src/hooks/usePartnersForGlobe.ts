import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { WCA_COUNTRIES_MAP, WCA_COUNTRIES, type WCACountry } from "@/data/wcaCountries";

export interface GlobePartner {
  id: string;
  company_name: string;
  city: string;
  country_code: string;
  country_name: string;
  email: string | null;
  partner_type: string | null;
  lat: number;
  lng: number;
}

export interface CountryWithPartners {
  code: string;
  name: string;
  count: number;
  lat: number;
  lng: number;
  region: WCACountry['region'];
}

// Pre-computed countries map for O(1) lookups (computed once at module load)
const PRECOMPUTED_COUNTRIES_MAP: Record<string, CountryWithPartners> = {};
const PRECOMPUTED_COUNTRIES: CountryWithPartners[] = WCA_COUNTRIES.map(country => {
  const cwp: CountryWithPartners = {
    code: country.code,
    name: country.name,
    count: 0,
    lat: country.lat,
    lng: country.lng,
    region: country.region,
  };
  PRECOMPUTED_COUNTRIES_MAP[country.code] = cwp;
  return cwp;
});

// Fetch all partners for globe visualization
export function usePartnersForGlobe() {
  return useQuery({
    queryKey: ["partners-globe"],
    queryFn: async () => {
      // Paginate to fetch ALL partners (bypass 1000-row default limit)
      const PAGE_SIZE = 2000;
      let allPartners: any[] = [];
      let offset = 0;

      while (true) {
        const { data, error } = await supabase
          .from("partners")
          .select("id, company_name, city, country_code, country_name, email, partner_type")
          .eq("is_active", true)
          .order("company_name")
          .range(offset, offset + PAGE_SIZE - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;
        allPartners = allPartners.concat(data);
        if (data.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      }

      // Reset counts efficiently
      const countryCounts: Record<string, number> = {};
      
      // Add lat/lng from country data with O(1) lookups
      const globePartners: GlobePartner[] = allPartners.map(p => {
        countryCounts[p.country_code] = (countryCounts[p.country_code] || 0) + 1;
        const country = PRECOMPUTED_COUNTRIES_MAP[p.country_code];
        return {
          ...p,
          lat: country?.lat || 0,
          lng: country?.lng || 0,
        };
      });

      // Update counts in pre-computed countries (single pass)
      const countriesWithPartners = PRECOMPUTED_COUNTRIES.map(c => ({
        ...c,
        count: countryCounts[c.code] || 0,
      }));

      const countriesMap = countriesWithPartners.reduce((acc, c) => {
        acc[c.code] = c;
        return acc;
      }, {} as Record<string, CountryWithPartners>);

      return {
        partners: globePartners,
        countries: countriesWithPartners,
        countriesMap,
      };
    },
    staleTime: 5_000,
    gcTime: 10 * 60 * 1000,
    refetchInterval: 30_000,
  });
}

// Fetch partners for a specific country
export function usePartnersByCountryForGlobe(countryCode: string | null) {
  return useQuery({
    queryKey: ["partners-globe-country", countryCode],
    queryFn: async () => {
      if (!countryCode) return [];

      // Paginate to get all partners for the country
      const PAGE_SIZE = 2000;
      let allData: any[] = [];
      let offset = 0;

      while (true) {
        const { data, error } = await supabase
          .from("partners")
          .select("id, company_name, city, country_code, country_name, email, partner_type")
          .eq("is_active", true)
          .eq("country_code", countryCode)
          .order("company_name")
          .range(offset, offset + PAGE_SIZE - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;
        allData = allData.concat(data);
        if (data.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      }

      const country = PRECOMPUTED_COUNTRIES_MAP[countryCode];
      
      return allData.map(p => ({
        ...p,
        lat: country?.lat || 0,
        lng: country?.lng || 0,
      }));
    },
    enabled: !!countryCode,
    staleTime: 5_000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: 30_000,
  });
}
