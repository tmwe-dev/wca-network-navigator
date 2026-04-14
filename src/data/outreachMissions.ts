/**
 * DAL — outreach_missions
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type MissionInsert = Database["public"]["Tables"]["outreach_missions"]["Insert"];

export async function insertOutreachMission(mission: MissionInsert) {
  const { data, error } = await supabase.from("outreach_missions").insert(mission).select().single();
  if (error) throw error;
  return data;
}
