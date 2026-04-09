import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

      const map: Record<string, PartnerContact[]> = {};
      // Batch in chunks of 200 to avoid query limits
      const CHUNK = 200;
      for (let i = 0; i < partnerIds.length; i += CHUNK) {
        const chunk = partnerIds.slice(i, i + CHUNK);
        const { data, error } = await supabase
          .from("partner_contacts")
          .select("id, partner_id, name, title, email, direct_phone, mobile, is_primary, contact_alias")
          .in("partner_id", chunk);

        if (error) throw error;
        for (const c of data ?? []) {
          if (!map[c.partner_id]) map[c.partner_id] = [];
          map[c.partner_id].push({
            id: c.id,
            partner_id: c.partner_id,
            name: c.name,
            title: c.title,
            email: c.email,
            direct_phone: c.direct_phone,
            mobile: c.mobile,
            is_primary: c.is_primary ?? false,
            contact_alias: c.contact_alias,
          });
        }
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
