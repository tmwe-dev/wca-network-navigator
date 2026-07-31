/**
 * useCountryStatsV2 — Country partner counts via RPC
 */
import { useQuery } from "@tanstack/react-query";
import { fetchPartnerCountryCodesRaw } from "@/v2/io/supabase/queries/partners";
import { queryKeys } from "@/lib/queryKeys";

export interface CountryStat {
  readonly country_code: string;
  readonly country_name: string;
  readonly count: number;
}

export function useCountryStatsV2() {
  return useQuery({
    queryKey: queryKeys.v2.countryStats,
    staleTime: 60_000,
    queryFn: async (): Promise<CountryStat[]> => {
      const result = await fetchPartnerCountryCodesRaw();
      if (result._tag === "Err") throw new Error(result.error.message);

      const counts = new Map<string, number>();
      for (const cc of result.value) {
        counts.set(cc, (counts.get(cc) ?? 0) + 1);
      }

      return Array.from(counts.entries())
        .map(([country_code, count]) => ({ country_code, country_name: country_code, count }))
        .sort((a, b) => b.count - a.count);
    },
  });
}
