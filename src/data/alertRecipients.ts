/**
 * DAL — alert_recipients + alert_dispatch_log
 */
import { untypedFrom } from "@/lib/supabaseUntyped";

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
  const { data, error } = await untypedFrom("alert_recipients")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AlertRecipient[];
}

export async function upsertAlertRecipient(
  userId: string,
  patch: Partial<AlertRecipient> & { name: string; whatsapp_e164: string },
): Promise<void> {
  const payload = { ...patch, user_id: userId } as Record<string, unknown>;
  if (patch.id) {
    const { error } = await untypedFrom("alert_recipients").update(payload as never).eq("id", patch.id);
    if (error) throw error;
  } else {
    const { error } = await untypedFrom("alert_recipients").insert(payload as never);
    if (error) throw error;
  }
}

export async function deleteAlertRecipient(id: string): Promise<void> {
  const { error } = await untypedFrom("alert_recipients").delete().eq("id", id);
  if (error) throw error;
}

export async function listAlertDispatchLog(userId: string, limit = 50): Promise<AlertDispatchLogRow[]> {
  const { data, error } = await untypedFrom("alert_dispatch_log")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AlertDispatchLogRow[];
}