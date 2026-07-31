/**
 * DAL — conteggi head per Explore tab counters.
 */
import { supabase } from "@/integrations/supabase/client";

export async function fetchTableHeadCount(table: "imported_contacts" | "business_cards"): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}
