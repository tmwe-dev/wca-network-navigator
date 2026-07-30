/**
 * DAL — conteggi globali dataset (Settings → Stato dati).
 * Estratto dai bypass DAL diretti di `DataSettingsTab`: stesse tabelle,
 * stesse count head query in parallelo, stessa aggregazione.
 */
import { supabase } from "@/integrations/supabase/client";

export interface GlobalDataCounts {
  partners: number;
  contacts: number;
  activities: number;
  messages: number;
}

export async function fetchGlobalDataCounts(): Promise<GlobalDataCounts> {
  const [partners, contacts, activities, messages] = await Promise.all([
    supabase.from("partners").select("id", { count: "exact", head: true }),
    supabase.from("imported_contacts").select("id", { count: "exact", head: true }),
    supabase.from("activities").select("id", { count: "exact", head: true }),
    supabase.from("channel_messages").select("id", { count: "exact", head: true }),
  ]);
  return {
    partners: partners.count ?? 0,
    contacts: contacts.count ?? 0,
    activities: activities.count ?? 0,
    messages: messages.count ?? 0,
  };
}
