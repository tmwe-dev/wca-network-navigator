/**
 * DAL — Campaign stats counts (READ-only)
 *
 * Aggregatore per il badge/stat card `useCampaignStatsV2` (batch D2).
 * Consolida 3 count head-only inline precedentemente in
 * `src/v2/hooks/useCampaignDraftsV2.ts`. Nessuna scrittura, RLS applicata
 * dall'utente autenticato. Filtri identici agli inline originari.
 *
 * Semantica errori: PRESERVATA identica all'inline originario (D2.1).
 * L'inline usava `count ?? 0` senza leggere `error`, quindi eventuali
 * failure auth/RLS/network venivano silenziate e il campo restituiva 0.
 * Manteniamo intenzionalmente lo stesso comportamento per equivalenza
 * osservabile su React Query (`isError` non si attiva, nessun retry,
 * nessun logging). Non aggiungere try/catch, retry o throw qui.
 */
import { supabase } from "@/integrations/supabase/client";

export interface CampaignStatsCounts {
  readonly sent: number;
  readonly pending: number;
  readonly completed: number;
}

function n(count: number | null | undefined): number {
  return count ?? 0;
}

export async function fetchCampaignStatsCounts(): Promise<CampaignStatsCounts> {
  const [sentRes, pendingRes, completedRes] = await Promise.all([
    supabase.from("email_campaign_queue").select("id", { count: "exact", head: true }).eq("status", "sent"),
    supabase.from("email_campaign_queue").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("email_drafts").select("id", { count: "exact", head: true }).eq("queue_status", "completed"),
  ]);

  // Semantica originaria: `count ?? 0` anche in presenza di `error`.
  return {
    sent: n(sentRes.count),
    pending: n(pendingRes.count),
    completed: n(completedRes.count),
  };
}
