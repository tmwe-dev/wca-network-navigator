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
import { fetchNavBadgeCountsRaw } from "@/data/navBadgeCountsV2";
import { fetchFunnemailUnreadCount } from "@/v2/io/supabase/queries/channel-messages";

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
      const [raw, funnemailRes] = await Promise.all([
        fetchNavBadgeCountsRaw(),
        // B4.5 — SSOT canonica: view `message_intelligence_v` con fallback
        // trasparente su `channel_messages` centralizzato nel DAL.
        fetchFunnemailUnreadCount(),
      ]);

      return {
        cestinone: raw.cestinone,
        cockpit: raw.cockpit,
        inbox: raw.inbox,
        funnemailInbox: funnemailRes._tag === "Ok" ? funnemailRes.value : 0,
        agenda: raw.agenda,
      };
    },
    refetchInterval: 30_000,
    placeholderData: EMPTY,
    staleTime: 15_000,
  });
}

/** Mappa path → conteggio (per look-up rapido nel menu). */
export function badgeForPath(counts: NavBadgeCounts | undefined, path: string): number {
  if (!counts) return 0;
  switch (path) {
    case "/v2/cestinone":
      return counts.cestinone;
    case "/v2/cockpit":
      return counts.cockpit;
    case "/v2/inbox":
      return counts.inbox;
    case "/v2/funnemail-inbox":
      return counts.funnemailInbox;
    case "/v2/agenda":
      return counts.agenda;
    default:
      return 0;
  }
}
