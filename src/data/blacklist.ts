/**
 * DAL — blacklist_entries & blacklist_sync_log
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type BlacklistInsert = Database["public"]["Tables"]["blacklist_entries"]["Insert"];
type SyncLogInsert = Database["public"]["Tables"]["blacklist_sync_log"]["Insert"];

export async function deleteBlacklistBySource(source: string) {
  const { error } = await supabase.from("blacklist_entries").delete().eq("source", source);
  if (error) throw error;
}

export async function insertBlacklistBatch(batch: BlacklistInsert[]) {
  const { error } = await supabase.from("blacklist_entries").insert(batch);
  if (error) throw error;
}

export async function findAllBlacklistEntries(select = "id, company_name, country") {
  const { data, error } = await supabase.from("blacklist_entries").select(select);
  if (error) throw error;
  return data ?? [];
}

export async function updateBlacklistEntry(id: string, updates: Partial<Database["public"]["Tables"]["blacklist_entries"]["Update"]>) {
  const { error } = await supabase.from("blacklist_entries").update(updates).eq("id", id);
  if (error) throw error;
}

export async function insertBlacklistSyncLog(log: SyncLogInsert) {
  const { error } = await supabase.from("blacklist_sync_log").insert(log);
  if (error) throw error;
}
