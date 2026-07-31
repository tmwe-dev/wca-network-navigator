/**
 * DAL — Analytics (response patterns + campaign jobs).
 * Estratto da src/components/analytics/**: semantica invariata.
 */
import { supabase } from "@/integrations/supabase/client";

export interface ResponsePatternStatsRow {
  channel: string | null;
  response_rate: number | null;
  total_sent: number | null;
  total_responses: number | null;
  updated_at: string | null;
}

export interface CampaignJobAnalyticsRow {
  id: string;
  status: string | null;
  country_code: string | null;
  country_name: string | null;
  created_at: string | null;
  completed_at: string | null;
}

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
