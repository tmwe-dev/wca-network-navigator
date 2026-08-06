/**
 * DAL — statistiche re-sync contatti per network (schermata Download → Re-sync).
 * Estratto da `ResyncConfigure`: stesse tabelle, stessi select e filtri.
 */
import { supabase } from "@/integrations/supabase/client";

export interface PartnerNetworkWithWcaRow {
  network_name: string;
  partner_id: string;
  partners: { wca_id: number | null } | null;
}

/** Associazioni network→partner con il `wca_id` del partner (inner join). */
export async function findPartnerNetworksWithWcaId(): Promise<PartnerNetworkWithWcaRow[]> {
  const { data } = await supabase.from("partner_networks").select("network_name, partner_id, partners!inner(wca_id)");
  return (data ?? []) as unknown as PartnerNetworkWithWcaRow[];
}

/** Coppie partner_id/email dei contatti (email eventualmente nulla). */
export async function findPartnerContactEmails(): Promise<Array<{ partner_id: string; email: string | null }>> {
  const { data } = await supabase.from("partner_contacts").select("partner_id, email");
  return (data ?? []) as Array<{ partner_id: string; email: string | null }>;
}

/** Contatti che hanno un'email valorizzata. */
export async function findPartnerContactsWithEmail(): Promise<Array<{ partner_id: string; email: string | null }>> {
  const { data } = await supabase.from("partner_contacts").select("partner_id, email").not("email", "is", null);
  return (data ?? []) as Array<{ partner_id: string; email: string | null }>;
}

/** Partner (id + wca_id) per un elenco di wca_id. */
export async function findPartnersByWcaIds(wcaIds: number[]): Promise<Array<{ id: string; wca_id: number | null }>> {
  const { data } = await supabase.from("partners").select("id, wca_id").in("wca_id", wcaIds).not("wca_id", "is", null);
  return (data ?? []) as Array<{ id: string; wca_id: number | null }>;
}
