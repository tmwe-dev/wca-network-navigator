/**
 * DAL — Analytics (response patterns + campaign jobs).
 * Estratto da src/components/analytics/**: semantica invariata.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ResponsePatternStatsRow = Pick<
  Database["public"]["Tables"]["response_patterns"]["Row"],
  "channel" | "response_rate" | "total_sent" | "total_responses" | "updated_at"
>;

export type CampaignJobAnalyticsRow = Pick<
  Database["public"]["Tables"]["campaign_jobs"]["Row"],
  "id" | "status" | "country_code" | "country_name" | "created_at" | "completed_at"
>;

export async function findResponsePatternStats(): Promise<ResponsePatternStatsRow[] | null> {
  const { data } = await supabase
    .from("response_patterns")
    .select("channel, response_rate, total_sent, total_responses, updated_at")
    .gt("total_sent", 0);
  return data;
}

export async function findCampaignJobsForAnalytics(): Promise<CampaignJobAnalyticsRow[] | null> {
  const { data } = await supabase
    .from("campaign_jobs")
    .select("id, status, country_code, country_name, created_at, completed_at")
    .order("created_at", { ascending: false });
  return data;
}
