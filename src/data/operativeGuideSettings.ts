/**
 * DAL — app_settings (chiave "operative_strategy").
 */
import { supabase } from "@/integrations/supabase/client";

/** Legge il valore grezzo (JSON stringificato) della guida operativa. */
export async function getOperativeStrategyValue(): Promise<string | null> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", "operative_strategy").maybeSingle();
  return data?.value ?? null;
}

/** Upsert della guida operativa per l'utente corrente. */
export async function upsertOperativeStrategy(userId: string, value: string): Promise<void> {
  const { error } = await supabase
    .from("app_settings")
    .upsert(
      { key: "operative_strategy", value, updated_at: new Date().toISOString(), user_id: userId },
      { onConflict: "user_id,key" },
    );
  if (error) throw error;
}
