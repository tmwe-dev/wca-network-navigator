import { useQuery } from "@tanstack/react-query";
import { findPartnerContactsByPartnerIds, type PartnerContactResult } from "@/data/partnerRelations";

export interface PartnerContact {
  id: string;
  partner_id: string;
  name: string;
  title: string | null;
  email: string | null;
  direct_phone: string | null;
  mobile: string | null;
  is_primary: boolean;
  contact_alias: string | null;
}

/**
 * Fetches contacts for a list of partner IDs, grouped by partner_id.
 */
export function usePartnerContacts(partnerIds: string[]) {
  return useQuery({
    queryKey: ["partner-contacts-for-campaign", partnerIds.sort().join(",")],
    queryFn: async () => {
      if (!partnerIds.length) return {} as Record<string, PartnerContact[]>;

      const data = await findPartnerContactsByPartnerIds(partnerIds);

      const map: Record<string, PartnerContact[]> = {};
      for (const c of data) {
        const raw = c as unknown as PartnerContactResult & { partner_id: string; is_primary?: boolean };
        const pid = raw.partner_id;
        if (!pid) continue;
        if (!map[pid]) map[pid] = [];
        map[pid].push({
          id: raw.id,
          partner_id: pid,
          name: raw.name,
          title: raw.title ?? null,
          email: raw.email ?? null,
          direct_phone: raw.direct_phone ?? null,
          mobile: raw.mobile ?? null,
          is_primary: raw.is_primary ?? false,
          contact_alias: raw.contact_alias ?? null,
        });
      }

      // Sort: primary first, then alphabetically
      for (const pid of Object.keys(map)) {
        map[pid].sort((a, b) => {
          if (a.is_primary && !b.is_primary) return -1;
          if (!a.is_primary && b.is_primary) return 1;
          return a.name.localeCompare(b.name);
        });
      }

      return map;
    },
    enabled: partnerIds.length > 0,
    staleTime: 60_000,
  });
}
