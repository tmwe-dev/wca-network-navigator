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

export async function getAppSettingByKey(key: string) {
  const { data, error } = await supabase.from("app_settings").select("value").eq("key", key).maybeSingle();
  if (error) throw error;
  return data?.value ?? null;
}

export async function findAppSettingId(key: string, userId: string) {
  const { data } = await supabase.from("app_settings").select("id").eq("key", key).eq("user_id", userId).maybeSingle();
  return data;
}

export async function updateAppSettingByKey(key: string, userId: string, value: string) {
  const { error } = await supabase.from("app_settings").update({ value }).eq("key", key).eq("user_id", userId);
  if (error) throw error;
}

export async function insertAppSetting(setting: { key: string; value: string; user_id: string }) {
  const { error } = await supabase.from("app_settings").insert(setting);
  if (error) throw error;
}

// LOVABLE-93: global pause
export async function getAiAutomationsPaused(userId: string): Promise<boolean> {
  const value = await getAppSetting("ai_automations_paused", userId);
  return value === "true";
}

export async function setAiAutomationsPaused(userId: string, paused: boolean, reason?: string): Promise<void> {
  const value = paused ? "true" : "false";
  await upsertAppSetting(userId, "ai_automations_paused", value);
  if (paused && reason) {
    await upsertAppSetting(userId, "ai_automations_paused_reason", reason);
    await upsertAppSetting(userId, "ai_automations_paused_at", new Date().toISOString());
  }
}
