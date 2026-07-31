/**
 * DAL — conteggi per sorgente arricchimento (Settings → Enrichment).
 * Estratto dai bypass DAL diretti di `EnrichmentSettingsTab`: stesse tabelle,
 * stesse count head query in parallelo, stesso filtro.
 */
import { supabase } from "@/integrations/supabase/client";

export interface EnrichmentSourceCounts {
  partners: number;
  contacts: number;
  emails: number;
  businessCards: number;
}

export async function fetchEnrichmentSourceCounts(): Promise<EnrichmentSourceCounts> {
  const [partners, contacts, emails, bca] = await Promise.all([
    supabase.from("partners").select("id", { count: "exact", head: true }),
    supabase.from("imported_contacts").select("id", { count: "exact", head: true }),
    supabase.from("channel_messages").select("id", { count: "exact", head: true }).eq("channel", "email"),
    supabase.from("business_cards").select("id", { count: "exact", head: true }),
  ]);
  return {
    partners: partners.count ?? 0,
    contacts: contacts.count ?? 0,
    emails: emails.count ?? 0,
    businessCards: bca.count ?? 0,
  };
}
