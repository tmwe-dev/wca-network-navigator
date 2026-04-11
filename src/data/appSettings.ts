/**
 * DAL — app_settings
 */
import { supabase } from "@/integrations/supabase/client";

export async function upsertAppSetting(userId: string, key: string, value: string) {
  const { error } = await supabase
    .from("app_settings")
    .upsert({ user_id: userId, key, value }, { onConflict: "user_id,key" });
  if (error) throw error;
}

export async function getAppSetting(key: string, userId: string) {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.value ?? null;
}
