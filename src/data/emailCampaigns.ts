/**
 * DAL — email_campaign_queue + email_drafts
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type QueueInsert = Database["public"]["Tables"]["email_campaign_queue"]["Insert"];
type DraftInsert = Database["public"]["Tables"]["email_drafts"]["Insert"];

export interface CampaignDraftRecipient {
  readonly partner_id: string;
  readonly email: string;
  readonly name?: string | null;
  readonly subject: string;
  readonly html: string;
}

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

export async function createCampaignDraftQueue(params: {
  readonly userId: string;
  readonly subject: string;
  readonly htmlBody: string;
  readonly partnerIds: readonly string[];
  readonly recipients: readonly CampaignDraftRecipient[];
}) {
  const draft: DraftInsert = {
    user_id: params.userId,
    subject: params.subject,
    html_body: params.htmlBody,
    category: "altro",
    recipient_type: "partner",
    recipient_filter: { partner_ids: [...params.partnerIds] },
    status: "ready",
    queue_status: "idle",
    total_count: params.recipients.length,
    sent_count: 0,
  };
  const { data, error } = await supabase.from("email_drafts").insert(draft).select("id").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Bozza email non creata");

  const rows: QueueInsert[] = params.recipients.map((r, i) => ({
    draft_id: data.id,
    partner_id: r.partner_id,
    recipient_email: r.email,
    recipient_name: r.name ?? null,
    subject: r.subject,
    html_body: r.html,
    status: "pending",
    position: i,
    user_id: params.userId,
  }));
  await insertCampaignQueueBatch(rows);
  return { draftId: data.id, queued: rows.length };
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
  const { error } = await supabase.from("email_drafts").update(updates as never).eq("id", id);
  if (error) throw error;
}

export async function getEmailDraftField(id: string, field: string) {
  const { data, error } = await supabase.from("email_drafts").select(field).eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function countEmailDrafts() {
  const { count, error } = await supabase.from("email_drafts").select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}
