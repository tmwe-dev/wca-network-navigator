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

/**
 * Filtro mailbox per le letture su `channel_messages`.
 * Rappresenta esattamente i due casi correnti del hook:
 *  - personal → `mailbox_id IS NULL`
 *  - shared   → `mailbox_id = <mailboxId>`
 * `null` (nessun filtro) quando la mailbox attiva non è ancora risolta.
 */
export type MailboxFilter =
  | { kind: "personal" }
  | { kind: "shared"; mailboxId: string };

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

/** Riga "regola indirizzo non classificata" così come letta dal DB. */
export interface UncategorizedAddressRuleRow {
  id: string;
  email_address: string;
  display_name: string | null;
  email_count: number | null;
  last_email_at: string | null;
  domain: string | null;
  company_name: string | null;
  ai_suggested_group: string | null;
  ai_suggestion_confidence: number | null;
  ai_suggestion_accepted: boolean | null;
  is_blocked: boolean | null;
}

/** Riga "regola indirizzo classificata" (group_id OPPURE group_name valorizzato). */
export interface ClassifiedAddressRuleRow extends UncategorizedAddressRuleRow {
  group_id: string | null;
  group_name: string | null;
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

/**
 * Legge tutte le regole indirizzo NON classificate: una riga è tale solo se
 * NESSUNO dei due campi (`group_id` legacy + `group_name`) è valorizzato.
 * Ordinamento per `email_count` decrescente. Errori propagati (throw).
 */
export async function fetchUncategorizedAddressRules(): Promise<UncategorizedAddressRuleRow[]> {
  return fetchAllRows<UncategorizedAddressRuleRow>((from, to) =>
    supabase
      .from("email_address_rules")
      .select("id, email_address, display_name, email_count, last_email_at, domain, company_name, ai_suggested_group, ai_suggestion_confidence, ai_suggestion_accepted, is_blocked")
      .is("group_id", null)
      .is("group_name", null)
      .order("email_count", { ascending: false })
      .range(from, to),
  );
}

/**
 * Legge tutte le regole indirizzo classificate (`group_id` OPPURE `group_name`
 * valorizzato), ordinate per `email_count` decrescente. Errori propagati (throw).
 */
export async function fetchClassifiedAddressRules(): Promise<ClassifiedAddressRuleRow[]> {
  return fetchAllRows<ClassifiedAddressRuleRow>((from, to) =>
    supabase
      .from("email_address_rules")
      .select("id, email_address, display_name, email_count, last_email_at, domain, company_name, ai_suggested_group, ai_suggestion_confidence, ai_suggestion_accepted, is_blocked, group_id, group_name")
      .or("group_id.not.is.null,group_name.not.is.null")
      .order("email_count", { ascending: false })
      .range(from, to),
  );
}

/**
 * Legge tutti gli indirizzi mittente delle email inbound dell'utente,
 * limitatamente alla mailbox indicata. Nessun dedup/conteggio qui: la
 * funzione ritorna le righe grezze `{ from_address }`, esattamente come
 * la query originale nel hook. Errori propagati (throw).
 */
export async function fetchInboundEmailSenderAddresses(params: {
  userId: string;
  mailbox: MailboxFilter | null;
}): Promise<Array<{ from_address: string | null }>> {
  const { userId, mailbox } = params;
  return fetchAllRows<{ from_address: string | null }>((from, to) => {
    let q = supabase
      .from("channel_messages")
      .select("from_address")
      .eq("channel", "email")
      .eq("direction", "inbound")
      .eq("user_id", userId)
      .not("from_address", "is", null)
      .order("id", { ascending: true })
      .range(from, to);
    if (mailbox?.kind === "personal") {
      q = q.is("mailbox_id", null);
    } else if (mailbox?.kind === "shared") {
      q = q.eq("mailbox_id", mailbox.mailboxId);
    }
    return q;
  });
}

/**
 * Aggiorna `email_count` di una singola regola indirizzo (write #10,
 * batch F20-P1.3D). Estratta 1:1 dal hook `useGroupingData`: stessa
 * tabella, stesso payload, stesso filtro `eq("id", id)` e stessa
 * semantica errori (throw dell'errore Supabase senza alterazione).
 * Batching (20) e `Promise.all` restano nel hook.
 */
export async function updateAddressRuleEmailCount(id: string, count: number): Promise<void> {
  const { error } = await supabase
    .from("email_address_rules")
    .update({ email_count: count })
    .eq("id", id);
  if (error) throw error;
}

/** Riga minimale usata per il ricalcolo di `email_count` in `populateAddressRules`. */
export interface AddressRuleCountRow {
  id: string;
  email_address: string;
  email_count: number | null;
}

/**
 * Legge tutte le regole indirizzo visibili con il solo trio
 * `id, email_address, email_count`, ordinate per `id` crescente
 * (read #9, batch F20-P1.3E). Paginazione a 1000 righe tramite
 * `fetchAllRows`; errori propagati (throw) come nel hook originale.
 */
export async function fetchAddressRuleCounts(): Promise<AddressRuleCountRow[]> {
  return fetchAllRows<AddressRuleCountRow>((from, to) =>
    supabase
      .from("email_address_rules")
      .select("id, email_address, email_count")
      .order("id", { ascending: true })
      .range(from, to),
  );
}

/**
 * Riga di upsert per `email_address_rules` così come costruita da
 * `populateAddressRules` (write #11). Contratto limitato alle sole
 * colonne realmente presenti nel batch: nessun allargamento.
 */
export interface NewAddressRuleRow {
  user_id: string;
  email_address: string;
  domain: string;
  email_count: number;
  is_active: boolean;
  company_name: string;
}

/**
 * Upsert di un chunk di nuove regole indirizzo (write #11, batch F20-P1.3F).
 * Estratto 1:1 dal hook: stessa tabella, stesso payload, stessa opzione
 * `onConflict: "user_id,email_address"`, nessun `.select()`, stessa
 * semantica errori (throw). Chunking (100) e await sequenziale restano nel hook.
 */
export async function upsertAddressRules(rows: NewAddressRuleRow[]): Promise<void> {
  const { error } = await supabase
    .from("email_address_rules")
    .upsert(rows, { onConflict: "user_id,email_address" });
  if (error) throw error;
}

/**
 * Riga di seed per `email_sender_groups` così come costruita da `loadData`
 * a partire da `DEFAULT_GROUPS`. Contratto limitato alle sole colonne
 * realmente inviate: nessun allargamento.
 */
export interface NewSenderGroupRow {
  nome_gruppo: string;
  descrizione: string;
  colore: string;
  icon: string;
  user_id: string;
  sort_order: number;
}

/**
 * Esito del seed dei gruppi predefiniti (write #4, batch F20-P1.3G).
 * Modella esplicitamente i due percorsi già presenti nel hook:
 *  - `created`  → l'upsert ha restituito righe (`.select()` non vuoto)
 *  - `fallback` → l'upsert non ha restituito nulla, quindi re-read ordinato
 */
export type SeedSenderGroupsResult =
  | { kind: "created"; groups: EmailSenderGroup[] }
  | { kind: "fallback"; groups: EmailSenderGroup[] };

/**
 * Seed idempotente dei gruppi predefiniti (write #4, batch F20-P1.3G).
 * Estratto 1:1 dal hook: stessa tabella, stesso payload, stesse opzioni
 * `onConflict: "nome_gruppo"` + `ignoreDuplicates: true`, stesso `.select()`,
 * stessa semantica errori (l'errore dell'upsert era ignorato dal hook) e
 * stesso fallback re-read ordinato via `fetchSenderGroupsOrdered`.
 * Toast e set di stato restano nel hook.
 */
export async function seedDefaultSenderGroups(
  rows: NewSenderGroupRow[],
): Promise<SeedSenderGroupsResult> {
  const { data: created } = await supabase
    .from("email_sender_groups")
    .upsert(rows, { onConflict: "nome_gruppo", ignoreDuplicates: true })
    .select();
  if (created && created.length > 0) {
    return { kind: "created", groups: created as EmailSenderGroup[] };
  }
  return { kind: "fallback", groups: await fetchSenderGroupsOrdered() };
}
