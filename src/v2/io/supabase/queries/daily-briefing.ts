/**
 * IO Queries: AI Session Briefings
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { PostgrestError } from "@supabase/supabase-js";

export type AiSessionBriefingRow = Database["public"]["Tables"]["ai_session_briefings"]["Row"];

export async function fetchDailyBriefingsRaw(): Promise<{
  data: AiSessionBriefingRow[] | null;
  error: PostgrestError | null;
}> {
  return supabase
    .from("ai_session_briefings")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5);
}
