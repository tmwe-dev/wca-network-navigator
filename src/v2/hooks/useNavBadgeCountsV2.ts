/**
 * useNavBadgeCountsV2 — Conta le attività "da fare" mostrate come badge
 * accanto alle voci del menu di navigazione globale.
 *
 * Mappatura voci → metrica:
 *  - /v2/cestinone        (Autorizza)        → azioni in coda da approvare
 *                                              (email_campaign_queue: pending|queued|scheduled)
 *  - /v2/cockpit          (Spedisci)         → drafts campagna pronti (campaign_jobs: pending|queued)
 *  - /v2/inbox            (Leggi)            → messaggi inbound non letti (tutti i canali)
 *  - /v2/funnemail-inbox  (Funnemail Inbox)  → email inbound non lette
 *  - /v2/agenda           (Agenda)           → activities con status=pending
 *
 * SOLO READ. Polling 30s. Non crea side-effect, non tocca pipeline esistenti.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface NavBadgeCounts {
  readonly cestinone: number;
  readonly cockpit: number;
  readonly inbox: number;
  readonly funnemailInbox: number;
  readonly agenda: number;
}

const EMPTY: NavBadgeCounts = {
  cestinone: 0,
  cockpit: 0,
  inbox: 0,
  funnemailInbox: 0,
  agenda: 0,
};

export function useNavBadgeCountsV2() {
  return useQuery({
    queryKey: ["v2", "nav-badge-counts"],
    queryFn: async (): Promise<NavBadgeCounts> => {
      const PENDING = ["pending", "queued", "scheduled"];
      const COCKPIT = ["pending", "queued"];

      const [cestRes, cockpitRes, inboxRes, funnemailRes, agendaRes] =
        await Promise.all([
          supabase
            .from("email_campaign_queue")
            .select("id", { count: "exact", head: true })
            .in("status", PENDING as never),
          supabase
            .from("campaign_jobs")
            .select("id", { count: "exact", head: true })
            .in("status", COCKPIT as never),
          supabase
            .from("channel_messages")
            .select("id", { count: "exact", head: true })
            .is("read_at", null)
            .eq("direction", "inbound"),
          supabase
            .from("channel_messages")
            .select("id", { count: "exact", head: true })
            .is("read_at", null)
            .eq("direction", "inbound")
            .eq("channel", "email"),
          supabase
            .from("activities")
            .select("id", { count: "exact", head: true })
            .eq("status", "pending"),
        ]);

      return {
        cestinone: cestRes.count ?? 0,
        cockpit: cockpitRes.count ?? 0,
        inbox: inboxRes.count ?? 0,
        funnemailInbox: funnemailRes.count ?? 0,
        agenda: agendaRes.count ?? 0,
      };
    },
    refetchInterval: 30_000,
    placeholderData: EMPTY,
    staleTime: 15_000,
  });
}

/** Mappa path → conteggio (per look-up rapido nel menu). */
export function badgeForPath(
  counts: NavBadgeCounts | undefined,
  path: string,
): number {
  if (!counts) return 0;
  switch (path) {
    case "/v2/cestinone": return counts.cestinone;
    case "/v2/cockpit": return counts.cockpit;
    case "/v2/inbox": return counts.inbox;
    case "/v2/funnemail-inbox": return counts.funnemailInbox;
    case "/v2/agenda": return counts.agenda;
    default: return 0;
  }
}