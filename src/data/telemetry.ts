/**
 * DAL — page_events
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type PageEventInsert = Database["public"]["Tables"]["page_events"]["Insert"];

export async function insertPageEvent(payload: PageEventInsert) {
  await supabase.from("page_events").insert(payload);
}

export async function findRequestLogsSince(sinceIso: string, limit = 500): Promise<unknown[]> {
  const { data, error } = await supabase
    .from("request_logs")
    .select("*")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/** Log delle richieste AI dal periodo indicato, più recenti prima. */
export async function findAiRequestLogsSince(sinceIso: string, limit = 500): Promise<unknown[]> {
  const { data, error } = await supabase
    .from("ai_request_log")
    .select("*")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/** Eventi di pagina dal periodo indicato, più recenti prima. */
export async function findPageEventsSince(sinceIso: string, limit = 500): Promise<unknown[]> {
  const { data, error } = await supabase
    .from("page_events")
    .select("*")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown[];
}
