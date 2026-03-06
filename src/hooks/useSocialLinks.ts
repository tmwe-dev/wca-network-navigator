import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
    queryKey: ["social-links", partnerId],
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

/**
 * Batch fetch social links for multiple partners in a single query.
 * Returns a Map<partnerId, SocialLink[]> for O(1) lookup per card.
 */
export function useBatchSocialLinks(partnerIds: string[]) {
  return useQuery({
    queryKey: ["social-links-batch", partnerIds],
    queryFn: async () => {
      if (!partnerIds.length) return new Map<string, SocialLink[]>();
      // Supabase .in() has a limit; chunk if needed
      const allLinks: SocialLink[] = [];
      const CHUNK = 500;
      for (let i = 0; i < partnerIds.length; i += CHUNK) {
        const chunk = partnerIds.slice(i, i + CHUNK);
        const { data, error } = await supabase
          .from("partner_social_links")
          .select("*")
          .in("partner_id", chunk);
        if (error) throw error;
        if (data) allLinks.push(...(data as SocialLink[]));
      }
      const map = new Map<string, SocialLink[]>();
      for (const link of allLinks) {
        const arr = map.get(link.partner_id) || [];
        arr.push(link);
        map.set(link.partner_id, arr);
      }
      return map;
    },
    enabled: partnerIds.length > 0,
    staleTime: 30_000,
  });
}

export function useUpsertSocialLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (link: {
      partner_id: string;
      contact_id?: string | null;
      platform: "linkedin" | "facebook" | "instagram" | "twitter" | "whatsapp";
      url: string;
    }) => {
      const { data, error } = await supabase
        .from("partner_social_links")
        .insert(link)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["social-links", vars.partner_id] });
      queryClient.invalidateQueries({ queryKey: ["social-links-batch"] });
    },
  });
}

export function useDeleteSocialLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, partnerId }: { id: string; partnerId: string }) => {
      const { error } = await supabase
        .from("partner_social_links")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return partnerId;
    },
    onSuccess: (partnerId) => {
      queryClient.invalidateQueries({ queryKey: ["social-links", partnerId] });
      queryClient.invalidateQueries({ queryKey: ["social-links-batch"] });
    },
  });
}
