/**
 * DAL — Funnemail message reminders (snooze).
 *
 * Usa il client tipizzato: la tabella è presente nei tipi generati, quindi
 * nessun boundary dinamico è necessario.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type ReminderRow = Database["public"]["Tables"]["funnemail_message_reminders"]["Row"];

export interface FunnemailReminderRow {
  id: string;
  message_id: string;
  group_id: string | null;
  remind_at: string;
  note: string | null;
  created_by: string;
  user_id: string;
  triggered_at: string | null;
  dismissed_at: string | null;
  created_at: string;
}

function mapReminderRow(row: ReminderRow): FunnemailReminderRow {
  return {
    id: row.id,
    message_id: row.message_id,
    group_id: row.group_id,
    remind_at: row.remind_at,
    note: row.note,
    created_by: row.created_by,
    user_id: row.user_id,
    triggered_at: row.triggered_at,
    dismissed_at: row.dismissed_at,
    created_at: row.created_at,
  };
}

export async function createReminder(args: {
  messageId: string;
  groupId?: string | null;
  remindAt: Date;
  note?: string | null;
}): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("not_authenticated");
  const { error } = await supabase.from("funnemail_message_reminders").insert({
    message_id: args.messageId,
    group_id: args.groupId ?? null,
    remind_at: args.remindAt.toISOString(),
    note: args.note ?? null,
    created_by: uid,
    user_id: uid,
  });
  if (error) throw error;
}

export async function dismissReminder(id: string): Promise<void> {
  const { error } = await supabase
    .from("funnemail_message_reminders")
    .update({ dismissed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function listActiveReminders(groupId?: string | null): Promise<FunnemailReminderRow[]> {
  let q = supabase.from("funnemail_message_reminders").select("*").is("dismissed_at", null).is("deleted_at", null);
  if (groupId) q = q.eq("group_id", groupId);
  const { data, error } = await q.order("remind_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapReminderRow);
}
