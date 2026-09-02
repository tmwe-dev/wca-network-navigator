/**
 * DAL: usage_events — telemetria d'uso (Lente 2 del Protocollo Bonifica).
 * Unico punto di scrittura su `public.usage_events`.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export interface UsageEventInput {
  name: string;
  kind: string;
  meta: Record<string, Json>;
}

/** Inserisce un evento d'uso. Ritorna il messaggio d'errore, o null se OK. */
export async function insertUsageEvent(event: UsageEventInput): Promise<string | null> {
  const { error } = await supabase.from("usage_events").insert(event);
  return error ? error.message : null;
}
