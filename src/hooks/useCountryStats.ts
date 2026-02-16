import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CountryStats {
  country_code: string;
  total_partners: number;
  hq_count: number;
  branch_count: number;
  with_profile: number;
  without_profile: number;
  with_email: number;
  with_phone: number;
  with_both: number;
}

/**
 * Single server-side aggregation query that returns ALL country stats.
 * Replaces multiple client-side queries that were hitting the 1000-row limit.
 */
export function useCountryStats() {
  return useQuery({
    queryKey: ["country-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_country_stats");
      if (error) throw error;

      const byCountry: Record<string, CountryStats> = {};
      let gTotal = 0, gEmail = 0, gPhone = 0, gBoth = 0, gProfile = 0, gNoProfile = 0;

      (data || []).forEach((r: any) => {
        const s: CountryStats = {
          country_code: r.country_code,
          total_partners: Number(r.total_partners) || 0,
          hq_count: Number(r.hq_count) || 0,
          branch_count: Number(r.branch_count) || 0,
          with_profile: Number(r.with_profile) || 0,
          without_profile: Number(r.without_profile) || 0,
          with_email: Number(r.with_email) || 0,
          with_phone: Number(r.with_phone) || 0,
          with_both: Number(r.with_both) || 0,
        };
        byCountry[s.country_code] = s;
        gTotal += s.total_partners;
        gEmail += s.with_email;
        gPhone += s.with_phone;
        gBoth += s.with_both;
        gProfile += s.with_profile;
        gNoProfile += s.without_profile;
      });

      return {
        byCountry,
        global: {
          total: gTotal,
          withEmail: gEmail,
          withPhone: gPhone,
          withBoth: gBoth,
          withProfile: gProfile,
          withoutProfile: gNoProfile,
        },
      };
    },
    staleTime: 60_000,
  });
}
