/**
 * DAL: system_flags — kill-switch globali (cron_paused, ecc.).
 */
import { supabase } from "@/integrations/supabase/client";

type FlagRow = { key: string; value: unknown; updated_at: string };

export async function getCronPaused(): Promise<boolean> {
  const { data, error } = await supabase
    .from("system_flags" as never)
    .select("value")
    .eq("key", "cron_paused")
    .maybeSingle();
  if (error) return false;
  const raw = (data as unknown as { value: unknown } | null)?.value;
  return raw === true || raw === "true";
}

export async function setCronPaused(paused: boolean, userId: string | null): Promise<void> {
  const { error } = await supabase
    .from("system_flags" as never)
    .upsert({
      key: "cron_paused",
      value: paused as unknown as Record<string, unknown>,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    } as never);
  if (error) throw error;
}

export async function listSystemFlags(): Promise<FlagRow[]> {
  const { data, error } = await supabase
    .from("system_flags" as never)
    .select("key, value, updated_at")
    .order("key", { ascending: true });
  if (error) return [];
  return (data as unknown as FlagRow[]) ?? [];
}