import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EmailDraft {
  id: string;
  subject: string | null;
  html_body: string | null;
  category: string | null;
  recipient_type: string;
  recipient_filter: any;
  attachment_ids: string[];
  link_urls: { label: string; url: string }[];
  status: string;
  sent_count: number;
  total_count: number;
  created_at: string;
  sent_at: string | null;
}

export function useEmailDrafts() {
  return useQuery({
    queryKey: ["email-drafts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_drafts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as EmailDraft[];
    },
  });
}

export function useSaveEmailDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (draft: Partial<EmailDraft> & { id?: string }) => {
      if (draft.id) {
        const { error } = await supabase
          .from("email_drafts")
          .update(draft as any)
          .eq("id", draft.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("email_drafts")
          .insert(draft as any)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-drafts"] }),
  });
}
