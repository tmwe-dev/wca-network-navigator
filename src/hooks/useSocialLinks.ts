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
    },
  });
}
