/**
 * useCountryStatsV2 — Country partner counts via RPC
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CountryStat {
  readonly country_code: string;
  readonly country_name: string;
  readonly count: number;
}

export function useCountryStatsV2() {
  return useQuery({
    queryKey: ["v2-country-stats"],
    staleTime: 60_000,
    queryFn: async (): Promise<CountryStat[]> => {
      const { data, error } = await supabase
        .from("partners")
        .select("country_code")
        .not("country_code", "is", null);

      if (error) throw error;

      const counts = new Map<string, number>();
      for (const row of data ?? []) {
        const cc = row.country_code as string;
        counts.set(cc, (counts.get(cc) ?? 0) + 1);
      }

      return Array.from(counts.entries())
        .map(([country_code, count]) => ({ country_code, country_name: country_code, count }))
        .sort((a, b) => b.count - a.count);
    },
  });
}
