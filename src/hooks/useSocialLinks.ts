import { useQuery } from "@tanstack/react-query";
import { findPartnerSocialLinks } from "@/data/partnerRelations";
import { queryKeys } from "@/lib/queryKeys";

export interface SocialLink {
  id: string;
  partner_id: string;
  contact_id: string | null;
  platform: string;
  url: string;
  created_at: string;
}

export function useSocialLinks(partnerId: string | null) {
  return useQuery({
    queryKey: queryKeys.socialLinks.byPartner(partnerId),
    queryFn: async () => {
      if (!partnerId) return [];
      const data = await findPartnerSocialLinks(partnerId);
      return data as unknown as SocialLink[];
    },
    enabled: !!partnerId,
  });
}

