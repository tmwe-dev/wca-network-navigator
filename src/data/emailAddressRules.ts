/**
 * DAL — email_address_rules
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type RuleUpdate = Database["public"]["Tables"]["email_address_rules"]["Update"];
type RuleInsert = Database["public"]["Tables"]["email_address_rules"]["Insert"];
type Json = Database["public"]["Tables"]["email_address_rules"]["Row"]["auto_action_params"];

/**
 * Serializzazione reale (non un cast): il round-trip JSON produce un valore
 * che è per costruzione un `Json` valido. `JSON.parse` restituisce `any`,
 * quindi l'assegnazione è tipizzata senza `as`.
 */
function serializeJson(value: unknown): Json {
  if (value === null || value === undefined) return null;
  const json: Json = JSON.parse(JSON.stringify(value));
  return json;
}

/** Converte un patch di dominio nel tipo Update generato, campo per campo. */
function toRuleUpdate(patch: Partial<EmailAddressRule>): RuleUpdate {
  const out: RuleUpdate = {};
  if (patch.email_address !== undefined) out.email_address = patch.email_address;
  if (patch.display_name !== undefined) out.display_name = patch.display_name;
  if (patch.category !== undefined) out.category = patch.category;
  if (patch.group_name !== undefined) out.group_name = patch.group_name;
  if (patch.custom_prompt !== undefined) out.custom_prompt = patch.custom_prompt;
  if (patch.notes !== undefined) out.notes = patch.notes;
  if (patch.is_active !== undefined) out.is_active = patch.is_active;
  if (patch.priority !== undefined) out.priority = patch.priority;
  if (patch.auto_action !== undefined) out.auto_action = patch.auto_action;
  if (patch.auto_action_params !== undefined) {
    out.auto_action_params = serializeJson(patch.auto_action_params);
  }
  if (patch.applied_count !== undefined) out.applied_count = patch.applied_count;
  if (patch.last_applied_at !== undefined) out.last_applied_at = patch.last_applied_at;
  if (patch.is_blocked !== undefined) out.is_blocked = patch.is_blocked;
  return out;
}

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
  const { error } = await supabase
    .from("email_address_rules")
    .update(toRuleUpdate(patch))
    .eq("id", id);
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
  const { error } = await supabase
    .from("email_address_rules")
    .update({
      auto_action: action,
      auto_action_params: serializeJson(params),
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
  const patch: RuleUpdate = blocked
    ? { is_blocked: true, auto_action: "spam", auto_execute: true }
    : { is_blocked: false };
  const { error } = await supabase
    .from("email_address_rules")
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
  const { data: existing, error: selErr } = await supabase
    .from("email_address_rules")
    .select("id")
    .eq("email_address", addr)
    .limit(1);
  if (selErr) throw selErr;
  const existingId = existing?.[0]?.id;
  if (existingId) {
    const { error } = await supabase
      .from("email_address_rules")
      .update(patch)
      .eq("id", existingId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("email_address_rules")
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
export async function updateAddressRuleById(id: string, payload: RuleUpdate): Promise<void> {
  const { error } = await supabase.from("email_address_rules").update(payload).eq("id", id);
  if (error) throw error;
}

/** Insert nuova regola con user_id esplicito. */
export async function insertAddressRule(payload: RuleInsert, userId: string): Promise<void> {
  const { error } = await supabase
    .from("email_address_rules")
    .insert({ ...payload, user_id: userId });
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

/** Id regola per (email_address, operator_id). */
export async function findAddressRuleIdByAddressAndOperator(
  emailAddress: string,
  operatorId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("email_address_rules")
    .select("id")
    .eq("email_address", emailAddress)
    .eq("operator_id", operatorId)
    .maybeSingle();
  return data?.id ?? null;
}

/** Insert regola completa restituendo l'id creato. */
export async function insertAddressRuleReturningId(
  payload: RuleInsert,
): Promise<string> {
  const { data, error } = await supabase
    .from("email_address_rules")
    .insert(payload)
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export interface AddressRuleMatchTargets {
  email_address: string | null;
  address: string | null;
  domain: string | null;
  domain_pattern: string | null;
}

/** Campi di matching (address/domain) di una regola. */
export async function getAddressRuleMatchTargets(
  ruleId: string,
): Promise<AddressRuleMatchTargets | null> {
  const { data } = await supabase
    .from("email_address_rules")
    .select("email_address, domain, address, domain_pattern")
    .eq("id", ruleId)
    .maybeSingle();
  return (data as AddressRuleMatchTargets | null) ?? null;
}

/** Agente esclusivo eventualmente bloccato su un indirizzo. */
export async function findExclusiveAgentForAddress(
  emailAddress: string,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("email_address_rules")
    .select("exclusive_agent_id")
    .eq("email_address", emailAddress)
    .eq("user_id", userId)
    .not("exclusive_agent_id", "is", null)
    .maybeSingle();
  return data?.exclusive_agent_id ?? null;
}

/** Regola (id + exclusive_agent_id) per indirizzo/utente. */
export async function findAddressRuleForUser(
  emailAddress: string,
  userId: string,
): Promise<{ id: string; exclusive_agent_id: string | null } | null> {
  const { data } = await supabase
    .from("email_address_rules")
    .select("id, exclusive_agent_id")
    .eq("email_address", emailAddress)
    .eq("user_id", userId)
    .maybeSingle();
  return data ?? null;
}

/** Imposta l'agente esclusivo su una regola esistente. */
export async function setAddressRuleExclusiveAgent(ruleId: string, agentId: string): Promise<void> {
  const { error } = await supabase
    .from("email_address_rules")
    .update({ exclusive_agent_id: agentId })
    .eq("id", ruleId);
  if (error) throw error;
}

export interface AddressRuleSummary {
  email_address: string;
  auto_action: string | null;
  preferred_channel: string | null;
  ai_confidence_threshold: number | null;
  success_rate: number | null;
  display_name: string | null;
  is_active: boolean | null;
}

/** Riepilogo regole indirizzo per la vista profili sender. */
export async function findAddressRuleSummaries(): Promise<AddressRuleSummary[]> {
  const { data, error } = await supabase
    .from("email_address_rules")
    .select("email_address, auto_action, preferred_channel, ai_confidence_threshold, success_rate, display_name, is_active");
  if (error) throw error;
  return data ?? [];
}

export interface EmailRuleWithStats {
  id: string;
  email_address: string;
  display_name: string | null;
  category: string | null;
  is_active: boolean;
  auto_action: string | null;
  auto_execute: boolean;
  ai_confidence_threshold: number;
  interaction_count: number;
  success_rate: number | null;
  last_interaction_at: string | null;
  created_at: string;
}

/** Regole email con statistiche di esecuzione (per AIAutomationDashboard). */
export async function findEmailAddressRulesWithStats(): Promise<EmailRuleWithStats[]> {
  const { data, error } = await supabase
    .from("email_address_rules")
    .select("id, email_address, display_name, category, is_active, auto_action, auto_execute, ai_confidence_threshold, interaction_count, success_rate, last_interaction_at, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as EmailRuleWithStats[];
}

export async function setEmailAddressRuleActive(ruleId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from("email_address_rules")
    .update({ is_active: isActive })
    .eq("id", ruleId);
  if (error) throw error;
}

/** Regole di archiviazione automatica (bounce hard) per un set di indirizzi. */
export async function findArchiveBounceRulesForEmails(emails: string[]): Promise<Array<{ email_address: string; notes: string | null }>> {
  if (emails.length === 0) return [];
  const { data, error } = await supabase
    .from("email_address_rules")
    .select("email_address, notes")
    .in("email_address", emails)
    .eq("auto_action", "archive");
  if (error) throw error;
  return data ?? [];
}

/* ── Prompt regola per singolo mittente (SenderActionsDialog) ──
 * Estratte da bypass diretti nel dialog azioni sender. Query, filtri e
 * semantica errori invariati.
 */

/** Id regola esistente per (email_address, user_id). */
export async function findAddressRuleIdForUserEmail(
  emailAddress: string,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("email_address_rules")
    .select("id")
    .eq("email_address", emailAddress)
    .eq("user_id", userId)
    .maybeSingle();
  return data?.id ?? null;
}

/** Aggiorna il prompt regola (custom_prompt + notes) su una regola esistente. */
export async function updateAddressRulePrompt(id: string, prompt: string): Promise<void> {
  const { error } = await supabase
    .from("email_address_rules")
    .update({ custom_prompt: prompt, notes: prompt, is_active: true })
    .eq("id", id);
  if (error) throw error;
}

/** Crea una nuova regola indirizzo con prompt custom per un mittente. */
export async function insertAddressRuleWithPrompt(row: {
  user_id: string;
  email_address: string;
  address: string;
  display_name: string;
  custom_prompt: string;
  notes: string;
  is_active: boolean;
}): Promise<void> {
  const { error } = await supabase.from("email_address_rules").insert(row);
  if (error) throw error;
}

export interface ReusablePromptRuleRow {
  id: string;
  email_address: string;
  display_name: string | null;
  custom_prompt: string | null;
}

/** Regole con prompt custom già usato, per il picker "riusa da altri mittenti". */
export async function findReusablePromptRules(userId: string): Promise<ReusablePromptRuleRow[]> {
  const { data } = await supabase
    .from("email_address_rules")
    .select("id, email_address, display_name, custom_prompt")
    .eq("user_id", userId)
    .not("custom_prompt", "is", null)
    .order("last_applied_at", { ascending: false, nullsFirst: false })
    .limit(100);
  return data ?? [];
}

/* ── Assegnazione gruppo (GroupDropZone) ── */

/** Sgancia una singola regola dal gruppo (rimozione mittente da un gruppo). */
export async function clearAddressRuleGroupAssignment(ruleId: string): Promise<{ error: unknown }> {
  const { error } = await supabase
    .from("email_address_rules")
    .update({ group_name: null, group_color: null, group_icon: null })
    .eq("id", ruleId);
  return { error };
}

/** Sgancia tutte le regole di un gruppo (eliminazione gruppo): conserva i prompt dedicati. */
export async function clearAddressRuleGroupAssignmentsByGroupName(groupName: string): Promise<void> {
  await supabase
    .from("email_address_rules")
    .update({
      group_name: null,
      group_color: null,
      group_icon: null,
      category: null,
    })
    .eq("group_name", groupName);
}
