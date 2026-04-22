/**
 * activitiesHandler.ts - Activity-related tool handlers
 * Handles: list, create, update
 */

import { supabase } from "./supabaseClient.ts";

interface ActivityRow {
  source_meta: Record<string, unknown> | null;
  [key: string]: unknown;
}

async function resolvePartnerId(
  args: Record<string, unknown>
): Promise<{ id: string; name: string } | null> {
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

export async function handleListActivities(
  args: Record<string, unknown>
): Promise<unknown> {
  let query = supabase
    .from("activities")
    .select(
      "id, title, activity_type, status, priority, due_date, partner_id, source_meta, created_at"
    )
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(Number(args.limit) || 30);
  if (args.status) query = query.eq("status", args.status);
  if (args.activity_type) query = query.eq("activity_type", args.activity_type);
  const { data, error } = await query;
  if (error) return { error: error.message };
  return {
    count: data?.length || 0,
    activities: (data || []).map((a: ActivityRow) => ({
      ...a,
      company_name: (a.source_meta as Record<string, unknown> | null)?.company_name || null,
    })),
  };
}

export async function handleCreateActivity(
  args: Record<string, unknown>,
  userId: string
): Promise<unknown> {
  let partnerId = args.partner_id as string | null;
  let companyName = (args.company_name as string) || "";
  if (!partnerId && companyName) {
    const r = await resolvePartnerId(args);
    if (r) {
      partnerId = r.id;
      companyName = r.name;
    }
  }
  const { data, error } = await supabase
    .from("activities")
    .insert({
      title: String(args.title),
      description: args.description ? String(args.description) : null,
      activity_type: String(args.activity_type),
      source_type: "partner",
      source_id: partnerId || crypto.randomUUID(),
      partner_id: partnerId,
      due_date: args.due_date ? String(args.due_date) : null,
      priority: String(args.priority || "medium"),
      source_meta: { company_name: companyName } as Record<string, unknown>,
      user_id: userId,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  return {
    success: true,
    activity_id: data.id,
    message: `Attività "${args.title}" creata.`,
  };
}

export async function handleUpdateActivity(
  args: Record<string, unknown>
): Promise<unknown> {
  const updates: Record<string, unknown> = {};
  if (args.status) {
    updates.status = args.status;
    if (args.status === "completed") updates.completed_at = new Date().toISOString();
  }
  if (args.priority) updates.priority = args.priority;
  if (args.due_date) updates.due_date = args.due_date;
  const { error } = await supabase
    .from("activities")
    .update(updates)
    .eq("id", args.activity_id);
  if (error) return { error: error.message };
  return { success: true, message: "Attività aggiornata." };
}
