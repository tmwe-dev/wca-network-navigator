import { useQuery } from "@tanstack/react-query";
import { countEmailMessagesByMailbox } from "@/data/channelMessages";
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
      return countEmailMessagesByMailbox(mailboxFilter);
    },
    refetchInterval: isSyncing ? 3000 : 30000,
    refetchOnWindowFocus: false,
  });
}
