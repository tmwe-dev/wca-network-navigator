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

/**
 * Legge il solo `value` di una app_setting per chiave (senza filtro user_id).
 * Estratta dal bypass DAL diretto di `src/lib/inbox/sessionTracker.ts`:
 * stessa select/eq/maybeSingle e stesso ritorno `{ data, error }` non-throw.
 */
export async function getAppSettingValueByKey(key: string) {
  return await supabase
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
}

/** Tutte le impostazioni di un utente come mappa chiave→valore. */
export async function findAppSettingsMapForUser(userId: string): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("key, value")
    .eq("user_id", userId);
  if (error) throw error;
  const map: Record<string, string> = {};
  (data ?? []).forEach((row) => { map[row.key] = row.value ?? ""; });
  return map;
}

/** Upsert manuale (key,user_id) — la tabella non ha vincolo unico affidabile. */
export async function saveAppSettingForUser(userId: string, key: string, value: string): Promise<void> {
  const { data: existing } = await supabase
    .from("app_settings")
    .select("id")
    .eq("key", key)
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) {
    const { error } = await supabase
      .from("app_settings")
      .update({ value })
      .eq("key", key)
      .eq("user_id", userId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("app_settings").insert({ key, value, user_id: userId });
    if (error) throw error;
  }
}

export interface PauseSettingsRow { key: string; value: string | null }

/** Righe app_settings correlate alla pausa globale automazioni AI. */
export async function findAiAutomationPauseSettings(userId: string): Promise<PauseSettingsRow[]> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("key, value")
    .eq("user_id", userId)
    .in("key", ["ai_automations_paused", "ai_automations_paused_at", "ai_automations_paused_reason"]);
  if (error) throw error;
  return data ?? [];
}

/** Upsert atomico (parallelo) dei settaggi di pausa automazioni AI. Ritorna true se tutte le operazioni sono andate a buon fine. */
export async function upsertAiAutomationPauseSettings(
  userId: string,
  isPausedValue: boolean,
  reason: string,
): Promise<boolean> {
  const updates = [
    supabase
      .from("app_settings")
      .upsert(
        { user_id: userId, key: "ai_automations_paused", value: isPausedValue ? "true" : "false" },
        { onConflict: "user_id,key" },
      ),
  ];

  if (isPausedValue) {
    updates.push(
      supabase
        .from("app_settings")
        .upsert(
          { user_id: userId, key: "ai_automations_paused_at", value: new Date().toISOString() },
          { onConflict: "user_id,key" },
        ),
    );

    if (reason.trim()) {
      updates.push(
        supabase
          .from("app_settings")
          .upsert(
            { user_id: userId, key: "ai_automations_paused_reason", value: reason },
            { onConflict: "user_id,key" },
          ),
      );
    }
  }

  const results = await Promise.all(updates);
  return !results.some((r) => r.error);
}
