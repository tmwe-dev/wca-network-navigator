/**
 * DAL — alert_recipients + alert_dispatch_log
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type RecipientRow = Database["public"]["Tables"]["alert_recipients"]["Row"];
type RecipientInsert = Database["public"]["Tables"]["alert_recipients"]["Insert"];
type RecipientUpdate = Database["public"]["Tables"]["alert_recipients"]["Update"];
type DispatchRow = Database["public"]["Tables"]["alert_dispatch_log"]["Row"];

export interface AlertRecipient {
  id: string;
  user_id: string;
  name: string;
  role: string | null;
  whatsapp_e164: string;
  email: string | null;
  categories: string[];
  min_urgency_score: number;
  is_active: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  timezone: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AlertDispatchLogRow {
  id: string;
  user_id: string;
  recipient_id: string;
  message_id: string | null;
  channel: string;
  business_category: string | null;
  urgency_score: number | null;
  alert_categories: string[];
  payload: Record<string, unknown>;
  status: string;
  error: string | null;
  created_at: string;
}

export async function listAlertRecipients(userId: string): Promise<AlertRecipient[]> {
  const { data, error } = await supabase
    .from("alert_recipients")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapRecipient);
}

function mapRecipient(row: RecipientRow): AlertRecipient {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    role: row.role,
    whatsapp_e164: row.whatsapp_e164,
    email: row.email,
    categories: row.categories,
    min_urgency_score: row.min_urgency_score,
    is_active: row.is_active,
    quiet_hours_start: row.quiet_hours_start,
    quiet_hours_end: row.quiet_hours_end,
    timezone: row.timezone,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toRecipientWrite(patch: Partial<AlertRecipient>): RecipientUpdate {
  const out: RecipientUpdate = {};
  if (patch.name !== undefined) out.name = patch.name;
  if (patch.role !== undefined) out.role = patch.role;
  if (patch.whatsapp_e164 !== undefined) out.whatsapp_e164 = patch.whatsapp_e164;
  if (patch.email !== undefined) out.email = patch.email;
  if (patch.categories !== undefined) out.categories = patch.categories;
  if (patch.min_urgency_score !== undefined) out.min_urgency_score = patch.min_urgency_score;
  if (patch.is_active !== undefined) out.is_active = patch.is_active;
  if (patch.quiet_hours_start !== undefined) out.quiet_hours_start = patch.quiet_hours_start;
  if (patch.quiet_hours_end !== undefined) out.quiet_hours_end = patch.quiet_hours_end;
  if (patch.timezone !== undefined) out.timezone = patch.timezone;
  if (patch.notes !== undefined) out.notes = patch.notes;
  return out;
}

export async function upsertAlertRecipient(
  userId: string,
  patch: Partial<AlertRecipient> & { name: string; whatsapp_e164: string },
): Promise<void> {
  if (patch.id) {
    const { error } = await supabase
      .from("alert_recipients")
      .update({ ...toRecipientWrite(patch), user_id: userId })
      .eq("id", patch.id);
    if (error) throw error;
  } else {
    const row: RecipientInsert = {
      ...toRecipientWrite(patch),
      name: patch.name,
      whatsapp_e164: patch.whatsapp_e164,
      user_id: userId,
    };
    const { error } = await supabase.from("alert_recipients").insert(row);
    if (error) throw error;
  }
}

export async function deleteAlertRecipient(id: string): Promise<void> {
  const { error } = await supabase.from("alert_recipients").delete().eq("id", id);
  if (error) throw error;
}

export async function listAlertDispatchLog(userId: string, limit = 50): Promise<AlertDispatchLogRow[]> {
  const { data, error } = await supabase
    .from("alert_dispatch_log")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(mapDispatch);
}

function toPayloadObject(value: DispatchRow["payload"]): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function mapDispatch(row: DispatchRow): AlertDispatchLogRow {
  return {
    id: row.id,
    user_id: row.user_id,
    recipient_id: row.recipient_id,
    message_id: row.message_id,
    channel: row.channel,
    business_category: row.business_category,
    urgency_score: row.urgency_score,
    alert_categories: row.alert_categories ?? [],
    payload: toPayloadObject(row.payload),
    status: row.status,
    error: row.error,
    created_at: row.created_at,
  };
}
