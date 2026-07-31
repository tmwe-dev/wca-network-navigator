/**
 * DAL — ai_session_briefings (daily briefing staff).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type DailyBriefingRow = Database["public"]["Tables"]["ai_session_briefings"]["Row"];

export async function findRecentBriefings(limit = 5): Promise<DailyBriefingRow[]> {
  const { data, error } = await supabase
    .from("ai_session_briefings")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return data ?? [];
}
