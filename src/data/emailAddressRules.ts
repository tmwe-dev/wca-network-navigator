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
    .eq("user_id", userId)
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
    .eq("user_id", userId)
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
    .eq("user_id", userId)
    .in("email_address", emails);
  if (error) throw error;
}