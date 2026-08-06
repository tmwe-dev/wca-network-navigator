/**
 * DAL — reminders (con partner correlato).
 */
import { supabase } from "@/integrations/supabase/client";

export interface ReminderRow {
  id: string;
  partner_id: string;
  due_date: string;
  title: string;
  description: string | null;
  status: string | null;
  priority: string | null;
  created_at: string | null;
  updated_at: string | null;
  partners?: {
    company_name: string;
    country_code: string;
  };
}

const REMINDER_SELECT = `
          *,
          partners (company_name, country_code)
        `;

export async function findReminders(): Promise<ReminderRow[]> {
  const { data, error } = await supabase
    .from("reminders")
    .select(REMINDER_SELECT)
    .order("due_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ReminderRow[];
}

export async function findPendingReminders(limit = 5): Promise<ReminderRow[]> {
  const { data, error } = await supabase
    .from("reminders")
    .select(REMINDER_SELECT)
    .eq("status", "pending")
    .order("due_date", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ReminderRow[];
}

/** Reminder di una specifica data (agenda giornaliera). */
export async function findRemindersByDueDate(dueDate: string, limit = 100): Promise<ReminderRow[]> {
  const { data, error } = await supabase
    .from("reminders")
    .select(`*, partners(company_name, country_code)`)
    .eq("due_date", dueDate)
    .order("due_date", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ReminderRow[];
}

export async function completeReminder(id: string): Promise<void> {
  const { error } = await supabase.from("reminders").update({ status: "completed" }).eq("id", id);
  if (error) throw error;
}
