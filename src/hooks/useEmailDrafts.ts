import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";
import { queryKeys } from "@/lib/queryKeys";
import {
  findEmailDrafts,
  updateEmailDraft,
  insertEmailDraftReturningRow,
} from "@/data/emailDrafts";

type DraftInsert = Database["public"]["Tables"]["email_drafts"]["Insert"];
type DraftUpdate = Database["public"]["Tables"]["email_drafts"]["Update"];

export interface EmailDraft {
  id: string;
  subject: string | null;
  html_body: string | null;
  category: string | null;
  recipient_type: string;
  recipient_filter: unknown;
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
    queryKey: queryKeys.email.drafts(),
    queryFn: async () => {
      const data = await findEmailDrafts();
      return data as unknown as EmailDraft[];
    },
  });
}

export function useSaveEmailDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (draft: Partial<EmailDraft> & { id?: string }) => {
      if (draft.id) {
        await updateEmailDraft(draft.id, draft as DraftUpdate);
      } else {
        return await insertEmailDraftReturningRow(draft as DraftInsert);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.email.drafts() }),
  });
}
