import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

export type MailboxFilter =
  | { kind: "personal" }
  | { kind: "shared"; id: string }
  | null
  | undefined;

function mailboxKeyOf(mb: MailboxFilter): string | undefined {
  if (!mb) return undefined;
  return mb.kind === "shared" ? `shared:${mb.id}` : "personal";
}

/**
 * Always returns the total email count from database.
 * When isSyncing=true, polls every 3s for live updates.
 */
export function useEmailCount(isSyncing = false, mailboxFilter?: MailboxFilter) {
  const mailboxKey = mailboxKeyOf(mailboxFilter);
  return useQuery({
    queryKey: queryKeys.email.countByMailbox(mailboxKey),
    queryFn: async () => {
      let q = supabase
        .from("channel_messages")
        .select("id", { count: "planned", head: true })
        .eq("channel", "email");
      if (mailboxFilter?.kind === "personal") q = q.is("mailbox_id", null);
      else if (mailboxFilter?.kind === "shared") q = q.eq("mailbox_id", mailboxFilter.id);
      const { count, error } = await q;
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: isSyncing ? 3000 : 30000,
    refetchOnWindowFocus: false,
  });
}
