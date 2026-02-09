import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

export function useContactCompleteness() {
  return useQuery({
    queryKey: ["contact-completeness"],
    queryFn: async () => {
      // Get all active partners
      const { data: partners, error: pErr } = await supabase
        .from("partners")
        .select("id, country_code")
        .eq("is_active", true);
      if (pErr) throw pErr;

      // Get all contacts with their data
      const { data: contacts, error: cErr } = await supabase
        .from("partner_contacts")
        .select("partner_id, email, direct_phone, mobile");
      if (cErr) throw cErr;

      // Build a map: partner_id -> { hasEmail, hasPhone }
      const contactMap: Record<string, { hasEmail: boolean; hasPhone: boolean }> = {};
      (contacts || []).forEach((c) => {
        const existing = contactMap[c.partner_id];
        const hasEmail = !!c.email;
        const hasPhone = !!c.direct_phone || !!c.mobile;
        if (existing) {
          if (hasEmail) existing.hasEmail = true;
          if (hasPhone) existing.hasPhone = true;
        } else {
          contactMap[c.partner_id] = { hasEmail, hasPhone };
        }
      });

      // Aggregate by country
      const byCountry: Record<string, CountryContactStats> = {};
      let gTotal = 0, gEmail = 0, gPhone = 0, gBoth = 0;

      (partners || []).forEach((p) => {
        const cc = p.country_code;
        if (!byCountry[cc]) {
          byCountry[cc] = { country_code: cc, total_partners: 0, with_personal_email: 0, with_personal_phone: 0, with_both: 0 };
        }
        byCountry[cc].total_partners++;
        gTotal++;

        const info = contactMap[p.id];
        if (info?.hasEmail) { byCountry[cc].with_personal_email++; gEmail++; }
        if (info?.hasPhone) { byCountry[cc].with_personal_phone++; gPhone++; }
        if (info?.hasEmail && info?.hasPhone) { byCountry[cc].with_both++; gBoth++; }
      });

      return {
        global: {
          total: gTotal,
          withEmail: gEmail,
          withPhone: gPhone,
          withBoth: gBoth,
          missingEmail: gTotal - gEmail,
          missingPhone: gTotal - gPhone,
          pct: gTotal > 0 ? Math.round((gEmail / gTotal) * 100) : 0,
        },
        byCountry,
      } as ContactCompletenessData;
    },
    staleTime: 60_000,
  });
}

/** Check if a single partner has personal contacts (for use with partner_contacts join) */
export function getPartnerContactQuality(partnerContacts: any[] | undefined): "complete" | "partial" | "missing" {
  if (!partnerContacts || partnerContacts.length === 0) return "missing";
  const hasEmail = partnerContacts.some((c: any) => !!c.email);
  const hasPhone = partnerContacts.some((c: any) => !!c.direct_phone || !!c.mobile);
  if (hasEmail && hasPhone) return "complete";
  if (hasEmail || hasPhone) return "partial";
  return "missing";
}
