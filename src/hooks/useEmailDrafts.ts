import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";
import { queryKeys } from "@/lib/queryKeys";
import {
  findEmailDrafts,
  type EmailDraftRow,
  updateEmailDraft,
  insertEmailDraftReturningRow,
} from "@/data/emailDrafts";

type DraftInsert = Database["public"]["Tables"]["email_drafts"]["Insert"];
type DraftUpdate = Database["public"]["Tables"]["email_drafts"]["Update"];

export type EmailDraft = EmailDraftRow;

export function useEmailDrafts() {
  return useQuery({
    queryKey: queryKeys.email.drafts(),
    queryFn: async () => {
      return findEmailDrafts();
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
