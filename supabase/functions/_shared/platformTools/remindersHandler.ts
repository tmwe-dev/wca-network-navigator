/**
 * remindersHandler.ts - Reminder-related tool handlers
 * Handles: list, create
 */

import { supabase } from "./supabaseClient.ts";

interface ResolvedPartner {
  id: string;
  name: string;
}

async function resolvePartnerId(
  args: Record<string, unknown>
): Promise<ResolvedPartner | null> {
  if (args.partner_id) {
    const { data } = await supabase
      .from("partners")
      .select("id, company_name")
      .eq("id", args.partner_id as string)
      .single();
    if (data) return { id: data.id, name: data.company_name };
  }
  if (args.company_name) {
    const { data } = await supabase
      .from("partners")
      .select("id, company_name")
      .ilike("company_name", `%${String(args.company_name)}%`)
      .limit(1)
      .single();
    if (data) return { id: data.id, name: data.company_name };
  }
  return null;
}

export async function handleListReminders(
  args: Record<string, unknown>
): Promise<unknown> {
  let query = supabase
    .from("reminders")
    .select("id, title, description, due_date, priority, status, partner_id")
    .order("due_date", { ascending: true })
    .limit(30);
  if (args.status) query = query.eq("status", args.status);
  if (args.priority) query = query.eq("priority", args.priority);
  const { data, error } = await query;
  if (error) return { error: error.message };
  return { count: data?.length || 0, reminders: data || [] };
}

export async function handleCreateReminder(
  args: Record<string, unknown>,
  userId: string
): Promise<unknown> {
  const partner = await resolvePartnerId(args);
  if (!partner) return { error: "Partner non trovato" };
  const { error } = await supabase.from("reminders").insert({
    partner_id: partner.id,
    title: String(args.title),
    description: args.description ? String(args.description) : null,
    due_date: String(args.due_date),
    priority: String(args.priority || "medium"),
    user_id: userId,
  });
  if (error) return { error: error.message };
  return { success: true, message: `Reminder creato per "${partner.name}".` };
}
