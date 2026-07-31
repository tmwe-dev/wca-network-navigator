/**
 * IO Queries: Cockpit Queue
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { PostgrestError } from "@supabase/supabase-js";

export type CockpitQueueRow = Database["public"]["Tables"]["cockpit_queue"]["Row"];

export async function fetchCockpitQueueRaw(): Promise<{
  data: CockpitQueueRow[] | null;
  error: PostgrestError | null;
}> {
  return supabase
    .from("cockpit_queue")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
}
