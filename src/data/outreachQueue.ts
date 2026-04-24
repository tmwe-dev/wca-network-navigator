/**
 * DAL — outreach_queue
 */
import { supabase } from "@/integrations/supabase/client";

export async function findPendingOutreachItems(limit = 5) {
  const { data, error } = await supabase
    .from("outreach_queue")
    .select("id, channel, recipient_name, recipient_email, recipient_phone, recipient_linkedin_url, subject, body, status, attempts, max_attempts, priority, created_by")
    .eq("status", "pending")
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function updateOutreachItem(id: string, updates: Record<string, unknown>) {
  const { error } = await supabase.from("outreach_queue").update(updates as never).eq("id", id);
  if (error) throw error;
}

export async function getOutreachItemField(id: string, field: string) {
  const { data, error } = await supabase.from("outreach_queue").select(field).eq("id", id).single();
  if (error) throw error;
  return data;
}

/**
 * Outreach queue row from v_outreach_today materialized view.
 * Denormalizes partner info and mission data to avoid N+1 queries.
 * Use this for outreach queue views and stat aggregations.
 */
export interface OutreachQueueRow {
  queue_id: string;
  user_id: string;
  channel: string;
  recipient_name: string;
  recipient_email: string;
  subject: string | null;
  status: string;
  attempts: number;
  max_attempts: number;
  priority: string;
  created_at: string;
  scheduled_for: string | null;
  partner_id: string | null;
  contact_id: string | null;
  // Denormalized partner data
  partner_name: string | null;
  partner_lead_status: string | null;
  partner_country: string | null;
  // Mission info
  mission_id: string | null;
  mission_name: string | null;
  // Last touch info
  last_outbound_at: string | null;
  last_channel: string | null;
}

/**
 * Fetch outreach queue items from v_outreach_today view.
 * Includes denormalized partner and mission info, avoiding multiple joins.
 */
export async function findPendingOutreachItemsFromView(
  status?: string,
  limit = 100,
  offset = 0
): Promise<OutreachQueueRow[]> {
  // P3.7: v_outreach_today view non esiste. Query diretta a outreach_queue
  // mappata sulla shape OutreachQueueRow. Campi denormalizzati a null.
  let q = supabase
    .from("outreach_queue")
    .select(
      "id, user_id, channel, recipient_name, recipient_email, subject, status, attempts, max_attempts, priority, created_at, partner_id, contact_id"
    );
  q = q.eq("status", status ?? "pending");
  const { data, error } = await q
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  type Row = {
    id: string;
    user_id: string | null;
    channel: string | null;
    recipient_name: string | null;
    recipient_email: string | null;
    subject: string | null;
    status: string | null;
    attempts: number | null;
    max_attempts: number | null;
    priority: string | null;
    created_at: string | null;
    partner_id: string | null;
    contact_id: string | null;
  };
  return ((data ?? []) as Row[]).map((r): OutreachQueueRow => ({
    queue_id: r.id,
    user_id: r.user_id ?? "",
    channel: r.channel ?? "",
    recipient_name: r.recipient_name ?? "",
    recipient_email: r.recipient_email ?? "",
    subject: r.subject,
    status: r.status ?? "",
    attempts: r.attempts ?? 0,
    max_attempts: r.max_attempts ?? 0,
    priority: r.priority ?? "",
    created_at: r.created_at ?? "",
    scheduled_for: null,
    partner_id: r.partner_id,
    contact_id: r.contact_id,
    partner_name: null,
    partner_lead_status: null,
    partner_country: null,
    mission_id: null,
    mission_name: null,
    last_outbound_at: null,
    last_channel: null,
  }));
}
