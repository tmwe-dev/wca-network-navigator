/**
 * DAL — outreach_missions
 */
import { supabase } from "@/integrations/supabase/client";

export async function insertOutreachMission(mission: Record<string, unknown>) {
  const { data, error } = await supabase.from("outreach_missions" as any).insert(mission as any).select().single();
  if (error) throw error;
  return data;
}
