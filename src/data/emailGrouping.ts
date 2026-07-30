/**
 * DAL — email grouping (manual grouping screen).
 *
 * Estratto da `useGroupingData` (finding P001-027, batch F20-P1.3A).
 * Contiene SOLO letture: nessuna auth, nessun realtime, nessuna write,
 * nessuna trasformazione UI. Query/colonne/filtri/ordinamenti/limiti e
 * semantica errori sono preservati 1:1 rispetto al hook originale.
 */
import { supabase } from "@/integrations/supabase/client";
import type { EmailSenderGroup } from "@/types/email-management";

/** Riga "regola assegnata a un gruppo" così come letta dal DB. */
export interface AssignedAddressRuleRow {
  id: string;
  email_address: string;
  display_name: string | null;
  group_name: string | null;
  created_at: string | null;
  company_name: string | null;
  domain: string | null;
}

/**
 * Paginazione a blocchi di 1000 righe per aggirare il limite di default
 * di Supabase. Errori propagati (throw), come nel hook originale.
 */
async function fetchAllRows<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const PAGE = 1000;
  const all: T[] = [];
  let offset = 0;
  let done = false;
  while (!done) {
    const { data, error } = await buildQuery(offset, offset + PAGE - 1);
    if (error) throw error;
    const batch = data ?? [];
    all.push(...batch);
    if (batch.length < PAGE) done = true;
    else offset += PAGE;
  }
  return all;
}

/**
 * Legge tutti i gruppi mittente ordinati per `sort_order` crescente.
 * Semantica errori preservata: in caso di errore ritorna lista vuota
 * (il hook originale ignorava `error` e usava `data || []`).
 */
export async function fetchSenderGroupsOrdered(): Promise<EmailSenderGroup[]> {
  const { data } = await supabase
    .from("email_sender_groups")
    .select("*")
    .order("sort_order", { ascending: true });
  return (data || []) as EmailSenderGroup[];
}

/**
 * Legge tutte le regole indirizzo già assegnate a un gruppo
 * (`group_name` non nullo), ordinate per `created_at` decrescente.
 * Errori propagati (throw).
 */
export async function fetchAssignedAddressRules(): Promise<AssignedAddressRuleRow[]> {
  return fetchAllRows<AssignedAddressRuleRow>((from, to) =>
    supabase
      .from("email_address_rules")
      .select("id, email_address, display_name, group_name, created_at, company_name, domain")
      .not("group_name", "is", null)
      .order("created_at", { ascending: false })
      .range(from, to),
  );
}
