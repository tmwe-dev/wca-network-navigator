/**
 * DAL — blacklist_entries ordinate per company_name (vista V2).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type BlacklistEntryRow = Database["public"]["Tables"]["blacklist_entries"]["Row"];

export async function findBlacklistEntriesOrdered(): Promise<BlacklistEntryRow[]> {
  const { data, error } = await supabase
    .from("blacklist_entries")
    .select("*")
    .order("company_name");
  if (error) return [];
  return data ?? [];
}
