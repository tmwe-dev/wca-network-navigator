/**
 * DAL — email_drafts
 */
import { supabase } from "@/integrations/supabase/client";

export async function countEmailDrafts() {
  const { count, error } = await supabase.from("email_drafts").select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

export async function insertEmailDraft(draft: Record<string, unknown>) {
  const { error } = await supabase.from("email_drafts").insert(draft as unknown);
  if (error) throw error;
}

export async function insertEmailDraftReturning(draft: Record<string, unknown>) {
  const { data, error } = await supabase.from("email_drafts").insert(draft as unknown)
  if (error) throw error;
  return data;
}
