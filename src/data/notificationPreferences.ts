/**
 * DAL — app_settings (preferenze di notifica utente, multi-riga).
 */
import { supabase } from "@/integrations/supabase/client";
import type { PostgrestError } from "@supabase/supabase-js";

export interface AppSettingKV {
  key: string;
  value: string | null;
}

/** Tutte le app_settings di un utente. */
export async function findAppSettingsForUser(userId: string): Promise<AppSettingKV[]> {
  const { data, error } = await supabase.from("app_settings").select("*").eq("user_id", userId);
  if (error) throw error;
  return data ?? [];
}

/** Upsert di più chiavi per un utente; ritorna gli eventuali errori (uno per chiave, stesso ordine). */
export async function upsertAppSettingsBatch(
  userId: string,
  entries: Array<{ key: string; value: string }>,
): Promise<Array<PostgrestError | null>> {
  const results = await Promise.all(
    entries.map((entry) =>
      supabase.from("app_settings").upsert(
        {
          user_id: userId,
          key: entry.key,
          value: entry.value,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,key" },
      ),
    ),
  );
  return results.map((r) => r.error);
}
