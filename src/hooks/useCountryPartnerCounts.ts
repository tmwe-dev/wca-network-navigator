import { useQuery } from "@tanstack/react-query";
import { getPartnerStats } from "@/data/partners";
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
      const stats = await getPartnerStats();
      const countMap: Record<string, number> = {};
      const nameMap: Record<string, string> = {};
      for (const [code, info] of Object.entries(stats.countryCounts)) {
        countMap[code] = info.count;
        nameMap[code] = info.name;
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
