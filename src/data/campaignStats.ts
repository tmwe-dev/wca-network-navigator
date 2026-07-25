/**
 * DAL — Campaign stats counts (READ-only)
 *
 * Aggregatore per il badge/stat card `useCampaignStatsV2` (batch D2).
 * Consolida 3 count head-only inline precedentemente in
 * `src/v2/hooks/useCampaignDraftsV2.ts`. Nessuna scrittura, RLS applicata
 * dall'utente autenticato. Filtri identici agli inline originari.
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
    supabase
      .from("email_campaign_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "sent"),
    supabase
      .from("email_campaign_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("email_drafts")
      .select("id", { count: "exact", head: true })
      .eq("queue_status", "completed"),
  ]);

  // Propaga eventuali errori auth/RLS/network — non mascherare.
  const firstError = sentRes.error ?? pendingRes.error ?? completedRes.error;
  if (firstError) throw firstError;

  return {
    sent: n(sentRes.count),
    pending: n(pendingRes.count),
    completed: n(completedRes.count),
  };
}