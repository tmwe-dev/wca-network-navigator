/**
 * DAL — partner_networks.
 * Estratto dal bypass DAL diretto di `src/lib/acquisition/scanDirectory.ts`.
 */
import { supabase } from "@/integrations/supabase/client";

/** Associazioni partner→network per un elenco di partner_id. */
export async function findPartnerNetworksByPartnerIds(partnerIds: string[]) {
  const { data } = await supabase
    .from("partner_networks")
    .select("partner_id, network_name")
    .in("partner_id", partnerIds);
  return data;
}
