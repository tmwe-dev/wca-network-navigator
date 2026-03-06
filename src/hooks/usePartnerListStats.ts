import { useMemo } from "react";
import { useCountryStats } from "@/hooks/useCountryStats";
import { asEnrichment } from "@/lib/partnerUtils";

interface UsePartnerListStatsArgs {
  countryCodes: string[];
  partners: any[] | undefined;
}

export function usePartnerListStats({ countryCodes, partners }: UsePartnerListStatsArgs) {
  const { data: countryStatsData } = useCountryStats();

  const serverStats = useMemo(() => {
    if (!countryStatsData?.byCountry || countryCodes.length === 0) return null;
    if (countryCodes.length === 1) return countryStatsData.byCountry[countryCodes[0]] || null;
    const agg = { total_partners: 0, with_profile: 0, with_deep_search: 0, with_email: 0, with_phone: 0, with_company_alias: 0, with_contact_alias: 0 };
    countryCodes.forEach(cc => {
      const s = countryStatsData.byCountry[cc];
      if (s) {
        agg.total_partners += s.total_partners;
        agg.with_profile += s.with_profile;
        agg.with_deep_search += s.with_deep_search;
        agg.with_email += s.with_email;
        agg.with_phone += s.with_phone;
        agg.with_company_alias += s.with_company_alias;
        agg.with_contact_alias += s.with_contact_alias;
      }
    });
    return agg;
  }, [countryStatsData, countryCodes]);

  const stats = useMemo(() => {
    if (serverStats) {
      return {
        total: serverStats.total_partners,
        withProfile: serverStats.with_profile,
        withDeep: serverStats.with_deep_search,
        withEmail: serverStats.with_email,
        withPhone: serverStats.with_phone,
        withAliasCo: serverStats.with_company_alias,
        withAliasCt: serverStats.with_contact_alias,
      };
    }
    const list = partners || [];
    const total = list.length;
    let withProfile = 0, withDeep = 0, withEmail = 0, withPhone = 0, withAliasCo = 0, withAliasCt = 0;
    list.forEach((p: any) => {
      if (p.raw_profile_html) withProfile++;
      if (asEnrichment(p.enrichment_data)?.deep_search_at) withDeep++;
      if (p.email || (p.partner_contacts || []).some((c: any) => c.email)) withEmail++;
      if (p.phone || (p.partner_contacts || []).some((c: any) => c.direct_phone || c.mobile)) withPhone++;
      if (p.company_alias) withAliasCo++;
      if ((p.partner_contacts || []).some((c: any) => c.contact_alias)) withAliasCt++;
    });
    return { total, withProfile, withDeep, withEmail, withPhone, withAliasCo, withAliasCt };
  }, [serverStats, partners]);

  const verified = useMemo(() => {
    const list = partners || [];
    const missingEmailList = list.filter((p: any) => !p.email && !(p.partner_contacts || []).some((c: any) => c.email));
    const emailVerified = missingEmailList.length === 0 || missingEmailList.every((p: any) => !!p.raw_profile_html);
    const missingPhoneList = list.filter((p: any) => !p.phone && !(p.partner_contacts || []).some((c: any) => c.direct_phone || c.mobile));
    const phoneVerified = missingPhoneList.length === 0 || missingPhoneList.every((p: any) => !!p.raw_profile_html);
    const missingDeepList = list.filter((p: any) => !asEnrichment(p.enrichment_data)?.deep_search_at);
    const deepVerified = missingDeepList.length === 0 || missingDeepList.every((p: any) => !!asEnrichment(p.enrichment_data)?.deep_search_at);
    const missingAliasCoList = list.filter((p: any) => !p.company_alias);
    const aliasCoVerified = missingAliasCoList.length === 0 || missingAliasCoList.every((p: any) => !!p.ai_parsed_at);
    const missingAliasCtList = list.filter((p: any) => !(p.partner_contacts || []).some((c: any) => c.contact_alias));
    const aliasCtVerified = missingAliasCtList.length === 0 || missingAliasCtList.every((p: any) => !!p.ai_parsed_at);
    return { email: emailVerified, phone: phoneVerified, deep: deepVerified, aliasCo: aliasCoVerified, aliasCt: aliasCtVerified };
  }, [partners]);

  const missingProfiles = stats.total - stats.withProfile;
  const missingDeep = stats.total - stats.withDeep;
  const missingAliasCo = stats.total - stats.withAliasCo;
  const missingAliasCt = stats.total - stats.withAliasCt;

  return { stats, verified, missingProfiles, missingDeep, missingAliasCo, missingAliasCt };
}
