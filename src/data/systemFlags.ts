/**
 * DAL: system_flags — kill-switch globali (cron_paused, ecc.).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { toJsonValue } from "@/lib/jsonGuards";

type SystemFlagRow = Database["public"]["Tables"]["system_flags"]["Row"];
export type FlagRow = Pick<SystemFlagRow, "key" | "value" | "updated_at">;

export async function getCronPaused(): Promise<boolean> {
  const { data, error } = await supabase
    .from("system_flags")
    .select("value")
    .eq("key", "cron_paused")
    .maybeSingle();
  if (error) return false;
  const raw: Json | undefined = data?.value;
  return raw === true || raw === "true";
}

export async function setCronPaused(paused: boolean, userId: string | null): Promise<void> {
  const { error } = await supabase
    .from("system_flags")
    .upsert({
      key: "cron_paused",
      value: toJsonValue(paused),
      updated_at: new Date().toISOString(),
      updated_by: userId,
    });
  if (error) throw error;
}

export async function listSystemFlags(): Promise<FlagRow[]> {
  const { data, error } = await supabase
    .from("system_flags")
    .select("key, value, updated_at")
    .order("key", { ascending: true });
  if (error) return [];
  return data ?? [];
}