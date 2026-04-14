/**
 * DAL — blacklist_entries & blacklist_sync_log
 */
import { supabase } from "@/integrations/supabase/client";

export async function deleteBlacklistBySource(source: string) {
  const { error } = await supabase.from("blacklist_entries").delete().eq("source", source);
  if (error) throw error;
}

export async function insertBlacklistBatch(batch: Record<string, unknown>[]) {
  const { error } = await supabase.from("blacklist_entries").insert(batch);
  if (error) throw error;
}

export async function findAllBlacklistEntries(select = "id, company_name, country") {
  const { data, error } = await supabase.from("blacklist_entries").select(select);
  if (error) throw error;
  return data ?? [];
}

export async function updateBlacklistEntry(id: string, updates: Record<string, unknown>) {
  const { error } = await supabase.from("blacklist_entries").update(updates).eq("id", id);
  if (error) throw error;
}

export async function insertBlacklistSyncLog(log: Record<string, unknown>) {
  const { error } = await supabase.from("blacklist_sync_log").insert(log);
  if (error) throw error;
}
