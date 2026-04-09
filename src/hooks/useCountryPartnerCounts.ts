import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { WCA_COUNTRIES, WCA_COUNTRIES_MAP } from "@/data/wcaCountries";

export interface CountryPartnerCount {
  code: string;
  name: string;
  count: number;
}

/**
 * Fetches real partner counts per country directly from the `partners` table.
 * Returns the full WCA country list with real counts overlaid — countries
 * without partners show count = 0.
 */
export function useCountryPartnerCounts() {
  return useQuery({
    queryKey: ["country-partner-counts"],
    queryFn: async () => {
      // Aggregate counts from partners table
      const PAGE_SIZE = 2000;
      const countMap: Record<string, number> = {};
      const nameMap: Record<string, string> = {};
      let offset = 0;

      while (true) {
        const { data, error } = await supabase
          .from("partners")
          .select("country_code, country_name")
          .eq("is_active", true)
          .range(offset, offset + PAGE_SIZE - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;

        for (const row of data) {
          const cc = row.country_code;
          countMap[cc] = (countMap[cc] || 0) + 1;
          if (!nameMap[cc]) nameMap[cc] = row.country_name;
        }

        if (data.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      }

      // Build full list: all WCA countries + any DB-only codes
      const allCodes = new Set<string>(WCA_COUNTRIES.map(c => c.code));
      Object.keys(countMap).forEach(cc => allCodes.add(cc));

      const countries: CountryPartnerCount[] = [];
      let totalPartners = 0;
      let activeCountries = 0;

      for (const code of allCodes) {
        const count = countMap[code] || 0;
        const name = nameMap[code] || WCA_COUNTRIES_MAP[code]?.name || code;
        countries.push({ code, name, count });
        totalPartners += count;
        if (count > 0) activeCountries++;
      }

      return {
        countries,
        totalPartners,
        activeCountries,
        totalCountries: countries.length,
      };
    },
    staleTime: 60_000,
    gcTime: 10 * 60 * 1000,
  });
}
