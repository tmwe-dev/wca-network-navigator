import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
      const { data, error } = await supabase
        .from("partner_social_links")
        .select("*")
        .eq("partner_id", partnerId);
      if (error) throw error;
      return data as SocialLink[];
    },
    enabled: !!partnerId,
  });
}

