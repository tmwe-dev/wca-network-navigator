/**
 * useMailboxSenderAllowlist — set di mittenti (from_address lowercased) che
 * hanno scritto almeno una email nella mailbox attualmente selezionata.
 *
 * Le tabelle `email_address_rules` e `email_sender_groups` sono condivise
 * tra tutti gli operatori: la stessa regola/gruppo vale per Booking, Luca, ecc.
 * Quello che cambia mailbox per mailbox è "chi mi ha effettivamente scritto".
 *
 * Convenzione coerente con useEmailCount/useChannelMessages:
 *   - kind === "personal" → channel_messages.mailbox_id IS NULL
 *   - kind === "shared"   → channel_messages.mailbox_id = activeMailbox.mailbox_id
 *
 * Ritorna `null` finché in caricamento (così i consumer possono mostrare
 * skeleton invece di "nessun mittente") e un `Set<string>` quando pronto.
 */
import { useQuery } from "@tanstack/react-query";
import { useActiveMailbox } from "@/contexts/ActiveMailboxContext";
import { findInboundEmailFromAddressesPage } from "@/data/channelMessages";

const PAGE = 1000;

export function useMailboxSenderAllowlist() {
  const { activeMailbox } = useActiveMailbox();
  const mailboxKey = activeMailbox
    ? `${activeMailbox.kind}:${activeMailbox.mailbox_id}`
    : "none";

  const query = useQuery({
    queryKey: ["mailbox-sender-allowlist", mailboxKey],
    enabled: !!activeMailbox,
    staleTime: 60_000,
    queryFn: async (): Promise<Set<string>> => {
      const set = new Set<string>();
      let offset = 0;
      // Loop paginato per superare il limite di 1000 di Supabase.
      // Eseguiamo SELECT ridotto a from_address e dedupliamo client-side.
       
      while (true) {
        const batch = await findInboundEmailFromAddressesPage({
          mailboxFilter: activeMailbox?.kind === "personal" ? "personal" : activeMailbox?.kind === "shared" ? "shared" : null,
          mailboxId: activeMailbox?.kind === "shared" ? activeMailbox.mailbox_id : null,
          offset,
          pageSize: PAGE,
        });
        for (const row of batch) {
          const k = (row.from_address || "").toLowerCase().trim();
          if (k && k.includes("@")) set.add(k);
        }
        if (batch.length < PAGE) break;
        offset += PAGE;
      }
      return set;
    },
  });

  return {
    allowlist: query.data ?? null,
    isLoading: query.isLoading,
    mailboxKey,
    activeMailbox,
  };
}