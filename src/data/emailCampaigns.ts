/**
 * DAL — email_campaign_queue + email_drafts
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type QueueInsert = Database["public"]["Tables"]["email_campaign_queue"]["Insert"];

export async function findCampaignQueueItems(draftId: string) {
  const { data, error } = await supabase
    .from("email_campaign_queue")
    .select("*")
    .eq("draft_id", draftId)
    .order("position", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function insertCampaignQueueBatch(items: QueueInsert[]) {
  for (let i = 0; i < items.length; i += 100) {
    const { error } = await supabase.from("email_campaign_queue").insert(items.slice(i, i + 100));
    if (error) throw error;
  }
}

export async function countPendingCampaignEmails() {
  const { count, error } = await supabase
    .from("email_campaign_queue")
    .select("*", { count: "exact", head: true })
    .in("status", ["pending", "sending"]);
  if (error) throw error;
  return count ?? 0;
}

export async function updateEmailDraft(id: string, updates: Record<string, unknown>) {
  const { error } = await supabase.from("email_drafts").update(updates).eq("id", id);
  if (error) throw error;
}

export async function getEmailDraftField(id: string, field: string) {
  const { data, error } = await supabase.from("email_drafts").select(field).eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function createEmailDraft(draft: Record<string, unknown>) {
  const { data, error } = await supabase.from("email_drafts").insert(draft as unknown)
  if (error) throw error;
  return data;
}

export async function countEmailDrafts() {
  const { count, error } = await supabase.from("email_drafts").select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}
