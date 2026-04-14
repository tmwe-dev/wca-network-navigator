import { useCountryStats } from "./useCountryStats";

export interface CountryContactStats {
  country_code: string;
  total_partners: number;
  with_personal_email: number;
  with_personal_phone: number;
  with_both: number;
}

export interface ContactCompletenessData {
  global: {
    total: number;
    withEmail: number;
    withPhone: number;
    withBoth: number;
    missingEmail: number;
    missingPhone: number;
    pct: number;
  };
  byCountry: Record<string, CountryContactStats>;
}

/**
 * Now delegates to useCountryStats (server-side aggregation).
 * No more client-side 1000-row limit issues.
 */
export function useContactCompleteness() {
  const query = useCountryStats();

  const data = query.data
    ? (() => {
        const byCountry: Record<string, CountryContactStats> = {};
        Object.values(query.data.byCountry).forEach(s => {
          byCountry[s.country_code] = {
            country_code: s.country_code,
            total_partners: s.total_partners,
            with_personal_email: s.with_email,
            with_personal_phone: s.with_phone,
            with_both: s.with_both,
          };
        });
        const g = query.data.global;
        return {
          global: {
            total: g.total,
            withEmail: g.withEmail,
            withPhone: g.withPhone,
            withBoth: g.withBoth,
            missingEmail: g.total - g.withEmail,
            missingPhone: g.total - g.withPhone,
            pct: g.total > 0 ? Math.round((g.withEmail / g.total) * 100) : 0,
          },
          byCountry,
        } as ContactCompletenessData;
      })()
    : undefined;

  return { ...query, data };
}

/** Check if a single partner has personal contacts */
export function getPartnerContactQuality(partnerContacts: any[] | undefined): "complete" | "partial" | "missing" {
  if (!partnerContacts || partnerContacts.length === 0) return "missing";
  const hasEmail = partnerContacts.some((c) => !!c.email);
  const hasPhone = partnerContacts.some((c) => !!c.direct_phone || !!c.mobile);
  if (hasEmail && hasPhone) return "complete";
  if (hasEmail || hasPhone) return "partial";
  return "missing";
}
