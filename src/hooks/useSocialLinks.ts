import { useQuery } from "@tanstack/react-query";
import { findPartnerSocialLinks, type PartnerSocialLinkRow } from "@/data/partnerRelations";
import { queryKeys } from "@/lib/queryKeys";

/** Contratto UI del social link: coincide con la riga restituita dal DAL. */
export type SocialLink = PartnerSocialLinkRow;

export function useSocialLinks(partnerId: string | null) {
  return useQuery({
    queryKey: queryKeys.socialLinks.byPartner(partnerId),
    queryFn: () => (partnerId ? findPartnerSocialLinks(partnerId) : Promise.resolve([])),
    enabled: !!partnerId,
  });
}
