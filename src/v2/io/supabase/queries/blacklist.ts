/**
 * IO Queries: Blacklist Entries
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { PostgrestError } from "@supabase/supabase-js";

export type BlacklistEntryRow = Database["public"]["Tables"]["blacklist_entries"]["Row"];

export async function fetchBlacklistEntriesRaw(): Promise<{
  data: BlacklistEntryRow[] | null;
  error: PostgrestError | null;
}> {
  return supabase.from("blacklist_entries").select("*").order("company_name");
}
