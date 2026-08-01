import { useQuery } from "@tanstack/react-query";
import { rpcGetCountryStats } from "@/data/rpc";
import { queryKeys } from "@/lib/queryKeys";

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
  with_deep_search: number;
  with_company_alias: number;
  with_contact_alias: number;
}

/**
 * Single server-side aggregation query that returns ALL country stats.
 * Replaces multiple client-side queries that were hitting the 1000-row limit.
 */
export function useCountryStats() {
  return useQuery({
    queryKey: queryKeys.countryStats,
    queryFn: async () => {
      const data = await rpcGetCountryStats();
      const _error = null;

      const byCountry: Record<string, CountryStats> = {};
      let gTotal = 0, gEmail = 0, gPhone = 0, gBoth = 0, gProfile = 0, gNoProfile = 0;
      let gDeep = 0, gAliasCo = 0, gAliasCt = 0;

      (data || []).forEach((r) => {
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
          with_deep_search: Number(r.with_deep_search) || 0,
          with_company_alias: Number(r.with_company_alias) || 0,
          with_contact_alias: Number(r.with_contact_alias) || 0,
        };
        byCountry[s.country_code] = s;
        gTotal += s.total_partners;
        gEmail += s.with_email;
        gPhone += s.with_phone;
        gBoth += s.with_both;
        gProfile += s.with_profile;
        gNoProfile += s.without_profile;
        gDeep += s.with_deep_search;
        gAliasCo += s.with_company_alias;
        gAliasCt += s.with_contact_alias;
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
          withDeepSearch: gDeep,
          withCompanyAlias: gAliasCo,
          withContactAlias: gAliasCt,
        },
      };
    },
    staleTime: 60_000,
  });
}
