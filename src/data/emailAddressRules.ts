/**
 * DAL — email_address_rules
 */
import { supabase } from "@/integrations/supabase/client";
import { untypedFrom } from "@/lib/supabaseUntyped";

export interface EmailAddressRule {
  id: string;
  user_id: string;
  email_address: string;
  display_name: string | null;
  category: string | null;
  group_name: string | null;
  custom_prompt: string | null;
  notes: string | null;
  is_active: boolean | null;
  priority: number | null;
  auto_action: string | null;
  auto_action_params: Record<string, unknown> | null;
  applied_count: number | null;
  last_applied_at: string | null;
  is_blocked: boolean | null;
}

export async function findEmailAddressRules(userId: string): Promise<EmailAddressRule[]> {
  const { data, error } = await supabase
    .from("email_address_rules")
    .select("id, user_id, email_address, display_name, category, group_name, custom_prompt, notes, is_active, priority, auto_action, auto_action_params, applied_count, last_applied_at")
    .order("priority", { ascending: false });
  if (error) throw error;
  return (data ?? []) as EmailAddressRule[];
}

export async function updateEmailAddressRule(id: string, patch: Partial<EmailAddressRule>): Promise<void> {
  // `auto_action_params` è Record<string, unknown> ma il tipo generato Supabase è Json
  // (ricorsivo). Compatibili a runtime — usiamo l'untypedFrom centralizzato.
  const { error } = await untypedFrom("email_address_rules").update(patch).eq("id", id);
  if (error) throw error;
}

/**
 * Bulk update auto_action (+ optional params) per la lista di email indicata,
 * per il SOLO user corrente (evita di toccare regole di altri operatori).
 * Usato dalle azioni batch della SenderActionBar (Segna lette, Elimina, Spam, etc.).
 */
export async function bulkUpdateAutoAction(
  userId: string,
  emails: string[],
  action: string,
  params: Record<string, unknown> = {},
): Promise<void> {
  if (emails.length === 0) return;
  const { error } = await untypedFrom("email_address_rules")
    .update({
      auto_action: action,
      auto_action_params: params,
      auto_execute: action !== "none",
    })
    .in("email_address", emails);
  if (error) throw error;
}

/**
 * Bulk set is_blocked + auto_action='spam' atomicamente.
 * Quando blocked=true: imposta spam IMAP + flag user-blocked.
 * Quando blocked=false: rimuove solo il flag (non tocca auto_action).
 */
export async function bulkSetBlocked(
  userId: string,
  emails: string[],
  blocked: boolean,
): Promise<void> {
  if (emails.length === 0) return;
  const patch = blocked
    ? { is_blocked: true, auto_action: "spam", auto_execute: true }
    : { is_blocked: false };
  const { error } = await untypedFrom("email_address_rules")
    .update(patch)
    .in("email_address", emails);
  if (error) throw error;
}

/**
 * Upsert (user_id, email_address) — assegna group_name e/o custom_prompt
 * direttamente da una vista email (Inbox detail). Crea la regola se non esiste.
 * Non tocca auto_action: l'utente continua a gestirlo da Funny Mail.
 */
export async function upsertEmailAddressRule(
  userId: string,
  emailAddress: string,
  patch: { group_name?: string | null; custom_prompt?: string | null; display_name?: string | null },
): Promise<void> {
  const addr = emailAddress.trim().toLowerCase();
  if (!addr) return;
  // Classificazione condivisa: cerco una regola esistente per questa email
  // (di qualsiasi operatore) e la aggiorno; se non esiste la creo col user_id corrente.
  const { data: existing, error: selErr } = await untypedFrom("email_address_rules")
    .select("id")
    .eq("email_address", addr)
    .limit(1);
  if (selErr) throw selErr;
  const existingId = (existing as Array<{ id: string }> | null)?.[0]?.id;
  if (existingId) {
    const { error } = await untypedFrom("email_address_rules")
      .update(patch)
      .eq("id", existingId);
    if (error) throw error;
  } else {
    const { error } = await untypedFrom("email_address_rules")
      .insert([{ user_id: userId, email_address: addr, ...patch }]);
    if (error) throw error;
  }
}