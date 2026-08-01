/**
 * DAL — user settings map (V2 Settings page).
 * Estratto da useSettingsV2: stesso filtro (solo valori truthy) e stessa forma.
 */
import { supabase } from "@/integrations/supabase/client";

export async function fetchUserSettingsMap(userId: string): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("key, value")
    .eq("user_id", userId);
  if (error) throw error;
  const map: Record<string, string> = {};
  data?.forEach((row) => {
    if (row.value) map[row.key] = row.value;
  });
  return map;
}
