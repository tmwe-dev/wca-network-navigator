/**
 * DAL — email_prompts
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export async function findActiveEmailPrompts(select = "id, title, scope", limit = 20) {
  const { data, error } = await supabase.from("email_prompts").select(select).eq("is_active", true).order("priority", { ascending: false }).limit(limit);
  if (error) throw error;
  return data ?? [];
}

export interface EmailPromptFull {
  id: string;
  user_id: string;
  scope: string;
  scope_value: string | null;
  title: string;
  instructions: string | null;
  is_active: boolean | null;
  priority: number | null;
}

export async function findEmailPromptsByScope(userId: string, scope: string): Promise<EmailPromptFull[]> {
  const { data, error } = await supabase
    .from("email_prompts")
    .select("id, user_id, scope, scope_value, title, instructions, is_active, priority")
    .eq("user_id", userId)
    .eq("scope", scope)
    .order("priority", { ascending: false });
  if (error) throw error;
  return (data ?? []) as EmailPromptFull[];
}

export async function updateEmailPrompt(id: string, patch: Partial<EmailPromptFull>): Promise<void> {
  const { error } = await supabase.from("email_prompts").update(patch).eq("id", id);
  if (error) throw error;
}

/* ── UI CRUD (RulesAndActionsTab → Prompt Manager) ──
 * Estratte da bypass DAL diretti. Ordinamento ed error semantics invariati.
 */

/** Tutti i prompt ordinati per priority DESC. */
export type EmailPromptRow = Database["public"]["Tables"]["email_prompts"]["Row"];

export async function findAllEmailPrompts(): Promise<EmailPromptRow[]> {
  const { data, error } = await supabase
    .from("email_prompts")
    .select("*")
    .order("priority", { ascending: false });
  if (error) throw error;
  return (data ?? []) as EmailPromptRow[];
}

/**
 * Update by id (Prompt Manager). Filtro obbligatorio: mai write globali.
 */
export async function updateEmailPromptById(
  id: string,
  payload: Database["public"]["Tables"]["email_prompts"]["Update"],
): Promise<void> {
  if (!id) throw new Error("updateEmailPromptById: id obbligatorio");
  const { error } = await supabase.from("email_prompts").update(payload).eq("id", id);
  if (error) throw error;
}

/** Insert nuovo prompt con user_id esplicito (errore non propagato, come il legacy). */
export async function insertEmailPrompt(
  payload: Omit<Database["public"]["Tables"]["email_prompts"]["Insert"], "user_id">,
  userId: string,
): Promise<void> {
  await supabase.from("email_prompts").insert({ ...payload, user_id: userId });
}

/** Toggle is_active. */
export async function setEmailPromptActive(id: string, isActive: boolean): Promise<void> {
  await supabase.from("email_prompts").update({ is_active: isActive }).eq("id", id);
}

/** Delete prompt. */
export async function deleteEmailPrompt(id: string): Promise<void> {
  await supabase.from("email_prompts").delete().eq("id", id);
}

/* ── Template prompt ufficiali (SenderActionsDialog) ── */

export interface EmailPromptTemplateRow {
  id: string;
  title: string;
  instructions: string | null;
  scope: string | null;
  scope_value: string | null;
}

/** Template prompt ufficiali attivi con instructions valorizzate, per il picker. */
export async function findActiveEmailPromptTemplates(userId: string): Promise<EmailPromptTemplateRow[]> {
  const { data } = await supabase
    .from("email_prompts")
    .select("id, title, instructions, scope, scope_value")
    .eq("user_id", userId)
    .eq("is_active", true)
    .not("instructions", "is", null)
    .order("priority", { ascending: false })
    .limit(50);
  return (data ?? []) as EmailPromptTemplateRow[];
}

/* ── prompt_templates (PromptTemplateSelector) ──
 * Tabella distinta da `email_prompts`, ma stesso dominio (template prompt UI).
 */

export type PromptTemplateRow = Database["public"]["Tables"]["prompt_templates"]["Row"];
type PromptTemplateInsert = Database["public"]["Tables"]["prompt_templates"]["Insert"];

/** Tutti i template prompt dell'utente, ordinati come nella UI legacy. */
export async function findPromptTemplatesForUser(userId: string): Promise<PromptTemplateRow[]> {
  const { data, error } = await supabase
    .from("prompt_templates")
    .select("*")
    .eq("user_id", userId)
    .order("is_system", { ascending: false })
    .order("category", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Verifica se i template di sistema esistono già per l'utente. */
export async function hasSystemPromptTemplates(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("prompt_templates")
    .select("name")
    .eq("user_id", userId)
    .eq("is_system", true)
    .limit(1);
  return !!(data && data.length > 0);
}

/**
 * Crea i template di sistema per l'utente. `23505` (violazione unique) è
 * atteso quando i template esistono già ed è tollerato dal caller.
 */
export async function insertSystemPromptTemplates(rows: PromptTemplateInsert[]): Promise<{ code?: string } | null> {
  const { error } = await supabase.from("prompt_templates").insert(rows);
  if (error && error.code !== "23505") throw error;
  return error ? { code: error.code } : null;
}
