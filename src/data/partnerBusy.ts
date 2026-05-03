/**
 * DAL — v_partner_busy
 *
 * Restituisce l'insieme dei partner_id attualmente "occupati":
 * cioè presenti in outreach_queue / campaign_jobs / cockpit_queue /
 * email_campaign_queue (collegata a un draft non ancora spedito).
 *
 * La vista è derivata in lettura, quindi rimuovere la riga di coda
 * fa rientrare automaticamente il partner tra i "free".
 */
import { untypedFrom } from "@/lib/supabaseUntyped";

export type BusyPartnerSource = "outreach" | "campaign" | "cockpit" | "draft";

export interface BusyPartnerRow {
  partner_id: string;
  source: BusyPartnerSource;
  since: string;
}

export async function findBusyPartnerIds(
  partnerIds?: string[]
): Promise<Set<string>> {
  let q = untypedFrom("v_partner_busy").select("partner_id");
  if (partnerIds && partnerIds.length > 0) {
    q = q.in("partner_id", partnerIds);
  }
  const { data, error } = await q;
  if (error) throw error;
  const out = new Set<string>();
  for (const row of (data as Array<{ partner_id: string | null }> | null) ?? []) {
    if (row.partner_id) out.add(row.partner_id);
  }
  return out;
}

export async function findBusyPartnerRows(
  partnerIds?: string[]
): Promise<BusyPartnerRow[]> {
  let q = untypedFrom("v_partner_busy").select("partner_id, source, since");
  if (partnerIds && partnerIds.length > 0) {
    q = q.in("partner_id", partnerIds);
  }
  const { data, error } = await q;
  if (error) throw error;
  return ((data as BusyPartnerRow[] | null) ?? []).filter((r) => !!r.partner_id);
}