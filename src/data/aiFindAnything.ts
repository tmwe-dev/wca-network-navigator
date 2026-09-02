/**
 * DAL: RPC `ai_find_anything` — ricerca trasversale su tutte le entità
 * principali senza conoscere il campo esatto. Sola lettura.
 */
import { supabase } from "@/integrations/supabase/client";

export interface FindAnythingPayload {
  results?: unknown[];
  partial?: boolean;
}

export async function rpcFindAnything(query: string, limit: number): Promise<FindAnythingPayload | null> {
  const { data, error } = await supabase.rpc("ai_find_anything", { p_query: query, p_limit: limit });
  if (error || !data) return null;
  return data as unknown as FindAnythingPayload;
}
