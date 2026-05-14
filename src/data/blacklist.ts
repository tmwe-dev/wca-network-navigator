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

/** Set di partner.id presenti in blacklist (tramite matched_partner_id). */
export async function getBlacklistedPartnerIds(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("blacklist_entries")
    .select("matched_partner_id")
    .not("matched_partner_id", "is", null);
  if (error) throw error;
  return new Set((data ?? []).map((r) => String(r.matched_partner_id)).filter(Boolean));
}

/** Set di company_name normalizzati (lowercase + trim) presenti in blacklist. */
export async function getBlacklistedCompanyNames(): Promise<Set<string>> {
  const { data, error } = await supabase.from("blacklist_entries").select("company_name");
  if (error) throw error;
  const out = new Set<string>();
  for (const r of data ?? []) {
    const n = String((r as { company_name?: string }).company_name ?? "")
      .toLowerCase()
      .trim();
    if (n) out.add(n);
  }
  return out;
}
