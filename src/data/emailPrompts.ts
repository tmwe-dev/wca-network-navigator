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
  const { error } = await supabase.from("email_prompts").update(patch as never).eq("id", id);
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
export async function updateEmailPromptById(id: string, payload: Record<string, unknown>): Promise<void> {
  if (!id) throw new Error("updateEmailPromptById: id obbligatorio");
  const { error } = await supabase
    .from("email_prompts")
    .update(payload as Database["public"]["Tables"]["email_prompts"]["Update"])
    .eq("id", id);
  if (error) throw error;
}

/** Insert nuovo prompt con user_id esplicito (errore non propagato, come il legacy). */
export async function insertEmailPrompt(payload: Record<string, unknown>, userId: string): Promise<void> {
  await supabase.from("email_prompts").insert({ ...payload, user_id: userId } as never);
}

/** Toggle is_active. */
export async function setEmailPromptActive(id: string, isActive: boolean): Promise<void> {
  await supabase.from("email_prompts").update({ is_active: isActive }).eq("id", id);
}

/** Delete prompt. */
export async function deleteEmailPrompt(id: string): Promise<void> {
  await supabase.from("email_prompts").delete().eq("id", id);
}
