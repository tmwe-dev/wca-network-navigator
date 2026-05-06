/**
 * DAL — Funnemail message reminders (snooze).
 */
import { supabase } from "@/integrations/supabase/client";

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

const TABLE = "funnemail_message_reminders" as const;

const fromAny = supabase.from as unknown as (t: string) => {
  select: (cols: string, opts?: Record<string, unknown>) => {
    is?: (col: string, val: null) => unknown;
    eq?: (col: string, val: unknown) => unknown;
    order?: (col: string, opts?: { ascending?: boolean }) => unknown;
  };
  insert: (row: Record<string, unknown>) => Promise<{ error: unknown }>;
  update: (patch: Record<string, unknown>) => {
    eq: (col: string, val: unknown) => Promise<{ error: unknown }>;
  };
};

export async function createReminder(args: {
  messageId: string;
  groupId?: string | null;
  remindAt: Date;
  note?: string | null;
}): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("not_authenticated");
  const { error } = await fromAny(TABLE).insert({
    message_id: args.messageId,
    group_id: args.groupId ?? null,
    remind_at: args.remindAt.toISOString(),
    note: args.note ?? null,
    created_by: uid,
    user_id: uid,
  });
  if (error) throw error as Error;
}

export async function dismissReminder(id: string): Promise<void> {
  const { error } = await fromAny(TABLE)
    .update({ dismissed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error as Error;
}

export async function listActiveReminders(groupId?: string | null): Promise<FunnemailReminderRow[]> {
  let q = (supabase.from as unknown as (t: string) => any)(TABLE)
    .select("*")
    .is("dismissed_at", null)
    .is("deleted_at", null);
  if (groupId) q = q.eq("group_id", groupId);
  const { data, error } = await q.order("remind_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as FunnemailReminderRow[];
}