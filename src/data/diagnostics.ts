/**
 * DAL — Diagnostics checks (DB ping + storage buckets)
 */
import { supabase } from "@/integrations/supabase/client";

export async function pingAppSettings(): Promise<void> {
  const { error } = await supabase.from("app_settings").select("id").limit(1);
  if (error) throw error;
}

export async function listStorageBucketsCount(): Promise<number> {
  const { data, error } = await supabase.storage.listBuckets();
  if (error) throw error;
  return data.length;
}
