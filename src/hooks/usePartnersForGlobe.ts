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

// Fetch all partners for globe visualization
export function usePartnersForGlobe() {
  return useQuery({
    queryKey: ["partners-globe"],
    queryFn: async () => {
      const { data: partners, error } = await supabase
        .from("partners")
        .select("id, company_name, city, country_code, country_name, email, partner_type")
        .eq("is_active", true)
        .order("company_name");

      if (error) throw error;

      // Add lat/lng from country data
      const globePartners: GlobePartner[] = (partners || []).map(p => {
        const country = WCA_COUNTRIES_MAP[p.country_code];
        return {
          ...p,
          lat: country?.lat || 0,
          lng: country?.lng || 0,
        };
      });

      // Build countries with partner counts
      const countryCounts: Record<string, number> = {};
      globePartners.forEach(p => {
        countryCounts[p.country_code] = (countryCounts[p.country_code] || 0) + 1;
      });

      // Include ALL WCA countries, even those with 0 partners
      const countriesWithPartners: CountryWithPartners[] = WCA_COUNTRIES.map(country => ({
        code: country.code,
        name: country.name,
        count: countryCounts[country.code] || 0,
        lat: country.lat,
        lng: country.lng,
        region: country.region,
      }));

      return {
        partners: globePartners,
        countries: countriesWithPartners,
        countriesMap: countriesWithPartners.reduce((acc, c) => {
          acc[c.code] = c;
          return acc;
        }, {} as Record<string, CountryWithPartners>),
      };
    },
  });
}

// Fetch partners for a specific country
export function usePartnersByCountryForGlobe(countryCode: string | null) {
  return useQuery({
    queryKey: ["partners-globe-country", countryCode],
    queryFn: async () => {
      if (!countryCode) return [];

      const { data, error } = await supabase
        .from("partners")
        .select(`
          id, 
          company_name, 
          city, 
          country_code, 
          country_name, 
          email, 
          partner_type,
          partner_services (service_category),
          partner_certifications (certification)
        `)
        .eq("is_active", true)
        .eq("country_code", countryCode)
        .order("company_name");

      if (error) throw error;

      const country = WCA_COUNTRIES_MAP[countryCode];
      
      return (data || []).map(p => ({
        ...p,
        lat: country?.lat || 0,
        lng: country?.lng || 0,
      }));
    },
    enabled: !!countryCode,
  });
}
