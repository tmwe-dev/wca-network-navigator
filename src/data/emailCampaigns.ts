/**
 * DAL — email_campaign_queue + email_drafts
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { emitBusyPartnersChanged } from "@/v2/hooks/useBusyPartners";

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
  emitBusyPartnersChanged();
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

export interface CampaignQueueRecipient {
  readonly partner_id: string;
  readonly email: string;
  readonly name: string;
  readonly subject: string;
  readonly html: string;
}

export interface CreateCampaignDraftQueueInput {
  readonly userId: string;
  readonly subject: string;
  readonly htmlBody: string;
  readonly partnerIds: ReadonlyArray<string>;
  readonly recipients: ReadonlyArray<CampaignQueueRecipient>;
}

export interface CreateCampaignDraftQueueResult {
  readonly draftId: string;
  readonly queued: number;
}

/**
 * Crea un email_drafts (status=ready) e accoda i destinatari in
 * email_campaign_queue (status=pending). Nessun invio diretto: l'utente
 * autorizzerà l'invio dalla coda "In Uscita".
 */
export async function createCampaignDraftQueue(
  input: CreateCampaignDraftQueueInput,
): Promise<CreateCampaignDraftQueueResult> {
  const { userId, subject, htmlBody, partnerIds, recipients } = input;

  const draftPayload = {
    user_id: userId,
    subject,
    html_body: htmlBody,
    status: "ready",
    total_count: recipients.length,
  } as unknown as Record<string, unknown>;
  void partnerIds;

  const { data: draftRow, error: draftErr } = await supabase
    .from("email_drafts")
    .insert(draftPayload as never)
    .select("id")
    .maybeSingle();
  if (draftErr) throw draftErr;
  const draftId = (draftRow as { id?: string } | null)?.id;
  if (!draftId) throw new Error("Impossibile creare la bozza email");

  const items: QueueInsert[] = recipients.map((r, idx) => ({
    draft_id: draftId,
    user_id: userId,
    partner_id: r.partner_id,
    recipient_email: r.email,
    recipient_name: r.name,
    subject: r.subject,
    html_body: r.html,
    status: "pending",
    position: idx,
    // Key stabile per (draft, partner): retry/dispatch ripetuti non duplicano l'invio.
    idempotency_key: `camp_${draftId}_${r.partner_id}`,
  } as unknown as QueueInsert));

  await insertCampaignQueueBatch(items);

  return { draftId, queued: items.length };
}

export interface CampaignDraftListRow {
  readonly id: string;
  readonly subject: string | null;
  readonly status: string;
  readonly total_count: number;
  readonly sent_count: number;
  readonly queue_status: string;
  readonly queue_delay_seconds: number;
  readonly created_at: string;
}

export async function findCampaignDrafts(limit = 50): Promise<CampaignDraftListRow[]> {
  const { data, error } = await supabase
    .from("email_drafts")
    .select("id, subject, status, total_count, sent_count, queue_status, queue_delay_seconds, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as CampaignDraftListRow[];
}

export interface CampaignQueueItemRow {
  readonly id: string;
  readonly recipient_email: string;
  readonly recipient_name: string | null;
  readonly status: string;
  readonly sent_at: string | null;
  readonly error_message: string | null;
}

export async function findCampaignQueueItemsForDraft(draftId: string, limit = 200): Promise<CampaignQueueItemRow[]> {
  const { data, error } = await supabase
    .from("email_campaign_queue")
    .select("id, recipient_email, recipient_name, status, sent_at, error_message")
    .eq("draft_id", draftId)
    .order("position", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as CampaignQueueItemRow[];
}

export async function setCampaignDraftQueueStatus(draftId: string, queueStatus: string): Promise<void> {
  const { error } = await supabase.from("email_drafts").update({ queue_status: queueStatus }).eq("id", draftId);
  if (error) throw error;
}

export async function findCampaignQueueStatuses(draftId?: string): Promise<Array<{ status: string }>> {
  let q = supabase.from("email_campaign_queue").select("status");
  if (draftId) q = q.eq("draft_id", draftId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export interface InsertEmailDraftInput {
  readonly subject: string;
  readonly html_body: string;
  readonly recipient_type: string;
  readonly status: string;
  readonly user_id: string;
}

export async function insertEmailDraft(input: InsertEmailDraftInput): Promise<void> {
  const { error } = await supabase.from("email_drafts").insert(input);
  if (error) throw error;
}
