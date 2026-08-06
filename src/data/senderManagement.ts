/**
 * DAL — Sender Management (tab classificazione mittenti drag&drop).
 * Estratto 1:1 da `SenderManagementTab`: stesse tabelle, stessi filtri,
 * stessi payload e stessa semantica errori (le read ignoravano `error`,
 * la creazione categoria lo propaga).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { EmailSenderGroup } from "@/types/email-management";

type SenderGroupInsert = Database["public"]["Tables"]["email_sender_groups"]["Insert"];
type AddressRuleInsert = Database["public"]["Tables"]["email_address_rules"]["Insert"];

/** Gruppi mittente dell'utente, ordinati per creazione crescente. */
export async function findSenderGroupsByUser(userId: string): Promise<EmailSenderGroup[]> {
  const { data } = await supabase
    .from("email_sender_groups")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  return (data || []) as EmailSenderGroup[];
}

/** Inserisce i gruppi predefiniti al primo accesso e ritorna le righe create. */
export async function insertSenderGroups(rows: SenderGroupInsert[]): Promise<EmailSenderGroup[] | null> {
  const { data } = await supabase.from("email_sender_groups").insert(rows).select();
  return (data as EmailSenderGroup[] | null) ?? null;
}

/** Crea una singola categoria e ritorna la riga creata. Errori propagati. */
export async function createSenderGroup(row: SenderGroupInsert): Promise<EmailSenderGroup> {
  const { data, error } = await supabase.from("email_sender_groups").insert(row).select().single();
  if (error) throw error;
  return data as EmailSenderGroup;
}

export interface InboundSenderMessageRow {
  from_address: string | null;
  direction: string | null;
  created_at: string;
}

/** Messaggi email inbound usati per aggregare i mittenti. */
export async function findInboundSenderMessages(): Promise<InboundSenderMessageRow[]> {
  const { data } = await supabase
    .from("channel_messages")
    .select("from_address, direction, created_at")
    .eq("channel", "email")
    .eq("direction", "inbound")
    .not("from_address", "is", null);
  return (data || []) as InboundSenderMessageRow[];
}

/** Indirizzi già assegnati a un gruppo per l'utente indicato. */
export async function findAssignedSenderAddresses(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from("email_address_rules")
    .select("email_address, group_name")
    .eq("user_id", userId)
    .not("group_name", "is", null);
  return (data || []).map((r) => r.email_address.toLowerCase());
}

/** Id della regola indirizzo esistente per (indirizzo, utente), se presente. */
export async function findAddressRuleIdByAddressAndUser(emailAddress: string, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("email_address_rules")
    .select("id")
    .eq("email_address", emailAddress)
    .eq("user_id", userId)
    .maybeSingle();
  return data?.id ?? null;
}

export interface SenderGroupAssignmentPatch {
  group_name: string;
  group_color?: string | null;
  group_icon?: string | null;
}

/** Aggiorna il gruppo di una regola esistente (errori ignorati, come l'originale). */
export async function updateAddressRuleSenderGroup(ruleId: string, patch: SenderGroupAssignmentPatch): Promise<void> {
  await supabase.from("email_address_rules").update(patch).eq("id", ruleId);
}

/** Crea la regola indirizzo per un mittente appena assegnato. */
export async function insertSenderAddressRule(row: AddressRuleInsert): Promise<void> {
  await supabase.from("email_address_rules").insert(row);
}

export interface SenderGroupNameRow {
  nome_gruppo: string;
  colore: string | null;
  icon: string | null;
}

/** Nome/colore/icona dei gruppi mittente di un utente, ordinati per sort_order. */
export async function findSenderGroupNamesByUser(userId: string): Promise<SenderGroupNameRow[]> {
  const { data } = await supabase
    .from("email_sender_groups")
    .select("nome_gruppo, colore, icon")
    .eq("user_id", userId)
    .order("sort_order", { ascending: true });
  return (data ?? []) as unknown as SenderGroupNameRow[];
}
