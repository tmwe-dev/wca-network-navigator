/**
 * Sibling Risk DAL — Same-Company Sibling Guard.
 *
 * Espone `checkSiblingRisk(partnerId, contactId?)` che chiama l'RPC
 * `check_sibling_risk` per ottenere la lista dei sibling (stesso partner
 * o stessa azienda con sedi diverse) già contattati di recente.
 *
 * Usato dalla coda di approvazione per evidenziare in rosso e richiedere
 * doppia conferma sulle azioni a rischio.
 */
import { supabase } from "@/integrations/supabase/client";

export interface SiblingRiskRow {
  sibling_contact_id: string;
  sibling_contact_name: string | null;
  sibling_partner_id: string;
  sibling_company_name: string | null;
  same_company: boolean;
  last_outbound_at: string;
  channel: string | null;
}

export async function checkSiblingRisk(
  partnerId: string,
  contactId?: string | null,
  windowDays = 30,
): Promise<SiblingRiskRow[]> {
  if (!partnerId) return [];
  const { data, error } = await (supabase as unknown as {
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: SiblingRiskRow[] | null; error: Error | null }>;
  }).rpc("check_sibling_risk", {
    _partner_id: partnerId,
    _contact_id: contactId ?? null,
    _window_days: windowDays,
  });
  if (error) {
    // non bloccare la UI di approvazione su errore di guard
    return [];
  }
  return data ?? [];
}
