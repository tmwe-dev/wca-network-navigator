/**
 * Hook that checks which partner/contact IDs are in the holding pattern
 * (lead_status in contacted, in_progress, negotiation).
 * Returns a Set of "p:<partnerId>" or "c:<contactId>" strings.
 */
import { useQuery } from "@tanstack/react-query";
import { getPartnersByIdsFiltered } from "@/data/partners";
import { getContactsByIds } from "@/data/contacts";

const ACTIVE_STATUSES = ["contacted", "in_progress", "negotiation"];

interface SourceRef {
  partnerId?: string;
  contactId?: string;
}

export function useHoldingPatternEmails(sources: SourceRef[]): Set<string> {
  const partnerIds = [...new Set(sources.map(s => s.partnerId).filter(Boolean))] as string[];
  const contactIds = [...new Set(sources.map(s => s.contactId).filter(Boolean))] as string[];

  const { data } = useQuery({
    queryKey: ["holding-pattern-emails", partnerIds.sort().join(","), contactIds.sort().join(",")],
    queryFn: async () => {
      const result = new Set<string>();

      if (partnerIds.length > 0) {
        const partners = await getPartnersByIdsFiltered(partnerIds, "id", { lead_status: ACTIVE_STATUSES });
        (partners || []).forEach((p: unknown) => result.add(`p:${p.id}`));
      }

      if (contactIds.length > 0) {
        const contacts = await getContactsByIds(contactIds, "id, lead_status");
        contacts.filter((c: unknown) => ACTIVE_STATUSES.includes(c.lead_status)).forEach((c: unknown) => result.add(`c:${c.id}`));
      }

      return [...result];
    },
    enabled: partnerIds.length > 0 || contactIds.length > 0,
    staleTime: 30_000,
  });

  return new Set(data || []);
}
