/**
 * DAL — email_drafts
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type DraftInsert = Database["public"]["Tables"]["email_drafts"]["Insert"];
type DraftUpdate = Database["public"]["Tables"]["email_drafts"]["Update"];

export async function findEmailDrafts() {
  const { data, error } = await supabase
    .from("email_drafts")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function updateEmailDraft(id: string, patch: DraftUpdate): Promise<void> {
  const { error } = await supabase.from("email_drafts").update(patch).eq("id", id);
  if (error) throw error;
}

export async function insertEmailDraftReturningRow(draft: DraftInsert) {
  const { data, error } = await supabase.from("email_drafts").insert(draft).select().single();
  if (error) throw error;
  return data;
}

export async function countEmailDrafts() {
  const { count, error } = await supabase.from("email_drafts").select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

export async function insertEmailDraft(draft: DraftInsert) {
  const { error } = await supabase.from("email_drafts").insert(draft);
  if (error) throw error;
}

export async function insertEmailDraftReturning(draft: DraftInsert) {
  const { data, error } = await supabase.from("email_drafts").insert(draft);
  if (error) throw error;
  return data;
}
