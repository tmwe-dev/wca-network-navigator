/**
 * Hook that checks which partner/contact IDs are in the holding pattern
 * (lead_status in first_touch_sent, holding, negotiation).
 * Returns a Set of "p:<partnerId>" or "c:<contactId>" strings.
 */
import { useQuery } from "@tanstack/react-query";
import { getPartnersByIdsFiltered } from "@/data/partners";
import { getContactsByIds } from "@/data/contacts";
import { queryKeys } from "@/lib/queryKeys";

const ACTIVE_STATUSES = ["first_touch_sent", "holding", "negotiation"];

interface SourceRef {
  partnerId?: string;
  contactId?: string;
}

export function useHoldingPatternEmails(sources: SourceRef[]): Set<string> {
  const partnerIds = [...new Set(sources.map(s => s.partnerId).filter(Boolean))] as string[];
  const contactIds = [...new Set(sources.map(s => s.contactId).filter(Boolean))] as string[];

  const { data } = useQuery({
    queryKey: queryKeys.contacts.holdingPatternEmails(partnerIds.sort().join(","), contactIds.sort().join(",")),
    queryFn: async () => {
      const result = new Set<string>();

      if (partnerIds.length > 0) {
        const partners = await getPartnersByIdsFiltered(partnerIds, "id", { lead_status: ACTIVE_STATUSES });
        (partners || []).forEach((p) => result.add(`p:${p.id}`));
      }

      if (contactIds.length > 0) {
        const contacts = await getContactsByIds(contactIds, "id, lead_status");
        contacts.filter((c) => ACTIVE_STATUSES.includes(c.lead_status as string)).forEach((c) => result.add(`c:${c.id}`));
      }

      return [...result];
    },
    enabled: partnerIds.length > 0 || contactIds.length > 0,
    staleTime: 30_000,
  });

  return new Set(data || []);
}
