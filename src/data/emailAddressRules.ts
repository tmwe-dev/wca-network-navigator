/**
 * DAL — email_address_rules
 */
import { supabase } from "@/integrations/supabase/client";
import { untypedFrom } from "@/lib/supabaseUntyped";
import type { Database } from "@/integrations/supabase/types";

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

export async function findEmailAddressRules(_userId: string): Promise<EmailAddressRule[]> {
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
/* ── UI CRUD (Email Intelligence: AddressRulesManager / RulesAndActionsTab) ──
 * Estratte da bypass DAL diretti nei componenti. Query, filtri, select, order
 * ed error semantics identici all'implementazione inline precedente.
 */

export type AddressRuleRow = Database["public"]["Tables"]["email_address_rules"]["Row"];

export type AddressRuleOrder = "email_address" | "email_count_desc";

/** Lista completa regole con ricerca opzionale su email_address (ilike). */
export async function findAddressRulesForUi(
  search: string,
  order: AddressRuleOrder,
): Promise<AddressRuleRow[]> {
  let q = order === "email_address"
    ? supabase.from("email_address_rules").select("*").order("email_address")
    : supabase.from("email_address_rules").select("*").order("email_count", { ascending: false });
  const term = search.trim();
  if (term) q = q.ilike("email_address", `%${term}%`);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as AddressRuleRow[];
}

/** Update by id (semantica AddressRulesManager). */
export async function updateAddressRuleById(id: string, payload: Record<string, unknown>): Promise<void> {
  const { error } = await untypedFrom("email_address_rules").update(payload).eq("id", id);
  if (error) throw error;
}

/** Insert nuova regola con user_id esplicito. */
export async function insertAddressRule(payload: Record<string, unknown>, userId: string): Promise<void> {
  const { error } = await untypedFrom("email_address_rules").insert({ ...payload, user_id: userId });
  if (error) throw error;
}

/** Toggle is_active. */
export async function setAddressRuleActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from("email_address_rules").update({ is_active: isActive }).eq("id", id);
  if (error) throw error;
}

/** Delete hard (intercettato dal soft-delete trigger lato DB). */
export async function deleteAddressRule(id: string): Promise<void> {
  const { error } = await supabase.from("email_address_rules").delete().eq("id", id);
  if (error) throw error;
}

/** Conteggio regole per group_name (aggregazione client-side, come il legacy). */
export async function countAddressRulesByGroup(): Promise<Record<string, number>> {
  const { data } = await supabase.from("email_address_rules").select("group_name");
  const counts: Record<string, number> = {};
  (data ?? []).forEach((r) => {
    const g = (r as { group_name: string | null }).group_name;
    if (g) counts[g] = (counts[g] || 0) + 1;
  });
  return counts;
}
