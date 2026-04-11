/**
 * DAL — directory_cache
 */
import { supabase } from "@/integrations/supabase/client";

export async function upsertDirectoryCache(entry: Record<string, unknown>) {
  const { error } = await supabase.from("directory_cache").upsert(entry as any, { onConflict: "country_code,network_name" });
  if (error) throw error;
}
