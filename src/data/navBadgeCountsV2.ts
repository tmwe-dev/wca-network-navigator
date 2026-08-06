/**
 * DAL — conteggi badge navigazione V2 (email_campaign_queue, campaign_jobs,
 * channel_messages, activities). Estratto da useNavBadgeCountsV2: stessi
 * filtri, stesso head-count in parallelo.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type EmailCampaignQueueStatus = Database["public"]["Tables"]["email_campaign_queue"]["Row"]["status"];
type CampaignJobStatus = Database["public"]["Tables"]["campaign_jobs"]["Row"]["status"];

export interface NavBadgeCountsRaw {
  readonly cestinone: number;
  readonly cockpit: number;
  readonly inbox: number;
  readonly agenda: number;
}

export async function fetchNavBadgeCountsRaw(): Promise<NavBadgeCountsRaw> {
  const PENDING: EmailCampaignQueueStatus[] = ["pending", "queued", "scheduled"];
  const COCKPIT: CampaignJobStatus[] = ["pending"];

  const [cestRes, cockpitRes, inboxRes, agendaRes] = await Promise.all([
    supabase.from("email_campaign_queue").select("id", { count: "exact", head: true }).in("status", PENDING),
    supabase.from("campaign_jobs").select("id", { count: "exact", head: true }).in("status", COCKPIT),
    supabase
      .from("channel_messages")
      .select("id", { count: "exact", head: true })
      .is("read_at", null)
      .eq("direction", "inbound"),
    supabase
      .from("activities")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .is("deleted_at", null),
  ]);

  return {
    cestinone: cestRes.count ?? 0,
    cockpit: cockpitRes.count ?? 0,
    inbox: inboxRes.count ?? 0,
    agenda: agendaRes.count ?? 0,
  };
}
