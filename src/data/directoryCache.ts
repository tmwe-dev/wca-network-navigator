/**
 * DAL — directory_cache
 */
import { supabase } from "@/integrations/supabase/client";

export async function upsertDirectoryCache(entry: Record<string, unknown>) {
  const { error } = await supabase.from("directory_cache").upsert(entry as never, { onConflict: "country_code,network_name" });
  if (error) throw error;
}

export async function findDirectoryCache(countryCodes: string[], networks?: string[]) {
  let q = supabase.from("directory_cache").select("*").in("country_code", countryCodes);
  if (networks && networks.length > 0) q = q.in("network_name", networks);
  else q = q.eq("network_name", "");
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}
