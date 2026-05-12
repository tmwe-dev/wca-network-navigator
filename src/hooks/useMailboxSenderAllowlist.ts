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
import { supabase } from "@/integrations/supabase/client";

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
        let q = supabase
          .from("channel_messages")
          .select("from_address")
          .eq("channel", "email")
          .eq("direction", "inbound")
          .not("from_address", "is", null)
          .order("id", { ascending: true })
          .range(offset, offset + PAGE - 1);

        if (activeMailbox?.kind === "personal") {
          q = q.is("mailbox_id", null);
        } else if (activeMailbox?.kind === "shared") {
          q = q.eq("mailbox_id", activeMailbox.mailbox_id);
        }

        const { data, error } = await q;
        if (error) throw error;
        const batch = (data ?? []) as Array<{ from_address: string | null }>;
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