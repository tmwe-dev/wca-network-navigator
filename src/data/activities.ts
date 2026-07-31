/**
 * Data Access Layer — Activities
 * Single source of truth for all activities table queries.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

type ActivityInsert = Database["public"]["Tables"]["activities"]["Insert"];
type ActivityUpdate = Database["public"]["Tables"]["activities"]["Update"];

// ─── Types ──────────────────────────────────────────────

export interface SourceMeta {
  company_name?: string;
  contact_name?: string;
  email?: string;
  country?: string;
  country_code?: string;
  city?: string;
  website?: string;
  position?: string;
}

export interface Activity {
  id: string;
  partner_id: string;
  assigned_to: string | null;
  activity_type: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  team_members?: { name: string } | null;
}

export interface AllActivity {
  id: string;
  partner_id: string | null;
  source_type: "partner" | "prospect" | "contact";
  source_id: string;
  source_meta: SourceMeta;
  activity_type: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  assigned_to: string | null;
  selected_contact_id: string | null;
  campaign_batch_id: string | null;
  executed_by_agent_id: string | null;
  created_at: string;
  completed_at: string | null;
  email_subject: string | null;
  email_body: string | null;
  scheduled_at: string | null;
  reviewed: boolean;
  sent_at: string | null;
  partners: {
    company_name: string;
    company_alias: string | null;
    country_code: string;
    country_name: string;
    city: string;
    enriched_at: string | null;
    website: string | null;
    logo_url: string | null;
    email: string | null;
  } | null;
  team_members: { name: string } | null;
  selected_contact: {
    id: string;
    name: string;
    email: string | null;
    direct_phone: string | null;
    mobile: string | null;
    title: string | null;
    contact_alias: string | null;
  } | null;
}

// ─── Constants ──────────────────────────────────────────

const ALL_ACTIVITIES_SELECT = `
  *,
  partners(company_name, company_alias, country_code, country_name, city, enriched_at, website, logo_url, email),
  team_members(name),
  selected_contact:partner_contacts!activities_selected_contact_id_fkey(id, name, email, direct_phone, mobile, title, contact_alias)
`;

// ─── Query Keys ─────────────────────────────────────────
export const activityKeys = {
  all: ["all-activities"] as const,
  forPartner: (partnerId: string) => ["activities", partnerId] as const,
};

// ─── Queries ────────────────────────────────────────────

export async function findActivitiesForPartner(partnerId: string): Promise<Activity[]> {
  const { data, error } = await supabase
    .from("activities")
    .select("*, team_members(name)")
    .eq("partner_id", partnerId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data as Activity[];
}

export async function findAllActivities(limit = 1000): Promise<AllActivity[]> {
  const { data, error } = await supabase
    .from("activities")
    .select(ALL_ACTIVITIES_SELECT)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as unknown as AllActivity[];
}

export async function createActivities(
  activities: Array<{
    partner_id?: string | null;
    source_type?: "partner" | "prospect" | "contact";
    source_id?: string;
    assigned_to?: string | null;
    activity_type: "send_email" | "phone_call" | "add_to_campaign" | "meeting" | "follow_up" | "other";
    title: string;
    description?: string | null;
    priority?: string;
    due_date?: string | null;
    scheduled_at?: string | null;
    campaign_batch_id?: string | null;
  }>
) {
  const cleaned = activities.map(a => ({
    ...a,
    assigned_to: a.assigned_to === "none" ? null : a.assigned_to,
    source_type: a.source_type || "partner",
    source_id: a.source_id || a.partner_id,
  }));
  const { data, error } = await supabase
    .from("activities")
    .insert(cleaned as ActivityInsert[])
    .select();
  if (error) throw error;
  return data;
}

export async function updateActivity(id: string, updates: Partial<Pick<AllActivity, "status" | "completed_at" | "selected_contact_id">>) {
  const { error } = await supabase
    .from("activities")
    .update(updates as ActivityUpdate)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteActivities(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const { error } = await supabase
    .from("activities")
    .delete()
    .in("id", ids);
  if (error) throw error;
  return ids.length;
}

export async function insertActivity(activity: ActivityInsert) {
  const { error } = await supabase.from("activities").insert(activity);
  if (error) throw error;
}

export async function countActivitiesWithNullPartner() {
  const { count, error } = await supabase.from("activities").select("*", { count: "exact", head: true }).is("partner_id", null).is("deleted_at", null);
  if (error) throw error;
  return count ?? 0;
}

export async function approveActivity(id: string) {
  const { error } = await supabase.from("activities").update({ status: "approved" as Database["public"]["Enums"]["activity_status"], reviewed: true }).eq("id", id);
  if (error) throw error;
}

// ─── Department Kanban ─────────────────────────────────

export type ActivityDepartment = "commercial" | "operations" | "admin" | "general";

export interface KanbanJobCard {
  id: string;
  title: string;
  activity_type: string;
  status: string;
  priority: string | null;
  due_date: string | null;
  created_at: string;
  department: ActivityDepartment | null;
  partner_id: string | null;
  partner_name: string | null;
  partner_country: string | null;
  description: string | null;
  email_subject: string | null;
  email_body: string | null;
  scheduled_at: string | null;
}

interface KanbanRow {
  id: string;
  title: string;
  activity_type: string;
  status: string;
  priority: string | null;
  due_date: string | null;
  created_at: string;
  department: ActivityDepartment | null;
  partner_id: string | null;
  partners: { company_name: string | null; country_code: string | null } | null;
  description: string | null;
  email_subject: string | null;
  email_body: string | null;
  scheduled_at: string | null;
}

export async function findActivitiesForKanban(limit = 500): Promise<KanbanJobCard[]> {
  // Solo job creati o schedulati da oggi in poi (no backlog storico).
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const sinceIso = startOfToday.toISOString();
  const { data, error } = await supabase
    .from("activities")
    .select("id, title, activity_type, status, priority, due_date, created_at, department, partner_id, description, email_subject, email_body, scheduled_at, partners(company_name, country_code)")
    .is("deleted_at", null)
    .not("status", "in", "(completed,cancelled)")
    .or(`created_at.gte.${sinceIso},due_date.gte.${sinceIso},scheduled_at.gte.${sinceIso}`)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = (data || []) as unknown as KanbanRow[];
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    activity_type: r.activity_type,
    status: r.status,
    priority: r.priority,
    due_date: r.due_date,
    created_at: r.created_at,
    department: r.department,
    partner_id: r.partner_id,
    partner_name: r.partners?.company_name ?? null,
    partner_country: r.partners?.country_code ?? null,
    description: r.description,
    email_subject: r.email_subject,
    email_body: r.email_body,
    scheduled_at: r.scheduled_at,
  }));
}

export async function updateActivityDepartment(id: string, department: ActivityDepartment | null): Promise<void> {
  const { error } = await supabase
    .from("activities")
    .update({ department } as unknown as ActivityUpdate)
    .eq("id", id);
  if (error) throw error;
}

/** Attività pending di un utente per una specifica data (cockpit). */
export async function findPendingActivitiesForDate(
  userId: string,
  dueDate: string,
  limit = 100,
) {
  const { data } = await supabase
    .from("activities")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "pending")
    .eq("due_date", dueDate)
    .is("deleted_at", null)
    .limit(limit);
  return data || [];
}

export interface ActivitySiblingRef {
  id: string;
  user_id: string | null;
  source_type: string | null;
  source_id: string | null;
  due_date: string | null;
  status: string;
}

/** Attività selezionate (per calcolo sibling da rimuovere). */
export async function findActivitiesByIds(ids: string[]): Promise<ActivitySiblingRef[]> {
  const { data, error } = await supabase
    .from("activities")
    .select("id, user_id, source_type, source_id, due_date, status")
    .in("id", ids)
    .is("deleted_at", null);
  if (error) throw error;
  return (data ?? []) as ActivitySiblingRef[];
}

/** Attività "sorelle": stesso utente/sorgente/data ancora pending. */
export async function findSiblingPendingActivityIds(ref: {
  user_id: string;
  source_id: string;
  due_date: string;
  source_type?: string | null;
}): Promise<string[]> {
  let q = supabase
    .from("activities")
    .select("id")
    .eq("user_id", ref.user_id)
    .eq("source_id", ref.source_id)
    .eq("due_date", ref.due_date)
    .eq("status", "pending")
    .is("deleted_at", null);
  if (ref.source_type) q = q.eq("source_type", ref.source_type);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => r.id);
}

// ─── Cache Invalidation ────────────────────────────────
export function invalidateActivityCache(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: activityKeys.all });
  qc.invalidateQueries({ queryKey: queryKeys.activities.all });
}

// ─── AI Generated Activities ────────────────────────────

export interface AIActivity {
  id: string;
  activity_type: string;
  title: string;
  description: string | null;
  status: string;
  due_date: string | null;
  priority: string;
  created_at: string;
  partner_id: string | null;
  source_meta: Record<string, unknown> | null;
}

const AI_ACTIVITY_SELECT = "id, activity_type, title, description, status, due_date, priority, created_at, partner_id, source_meta";

/** Attività pendenti generate dall'AI (ultime N). */
export async function findAIGeneratedActivities(limit = 10): Promise<AIActivity[]> {
  const { data, error } = await supabase
    .from("activities")
    .select(AI_ACTIVITY_SELECT)
    .eq("status", "pending")
    .eq("source_type", "ai_generated")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as AIActivity[];
}

export async function setActivityStatus(activityId: string, status: string): Promise<void> {
  const { error } = await supabase
    .from("activities")
    .update({ status } as unknown as ActivityUpdate)
    .eq("id", activityId);
  if (error) throw error;
}

export async function updateActivityDescription(id: string, description: string): Promise<void> {
  const { error } = await supabase
    .from("activities")
    .update({ description })
    .eq("id", id);
  if (error) throw error;
}

/** Risolve un riferimento attività (UUID esatto o titolo fuzzy, non completate) → {id, title}. */
export async function findActivityRef(ref: string, byId: boolean): Promise<{ id: string; title: string } | null> {
  if (byId) {
    const { data } = await supabase.from("activities").select("id, title").eq("id", ref).maybeSingle();
    return data ? { id: data.id as string, title: (data.title ?? "") as string } : null;
  }
  const { data } = await supabase
    .from("activities")
    .select("id, title")
    .ilike("title", `%${ref}%`)
    .neq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? { id: data.id as string, title: (data.title ?? "") as string } : null;
}

/** Patch arbitrario di un'attività per id (usato dai tool Command). */
export async function patchActivity(id: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from("activities").update(patch as ActivityUpdate).eq("id", id);
  if (error) throw error;
}

/** Insert di un'attività human con campi custom (usato dal tool Command schedule-activity). */
export async function insertHumanActivity(activity: ActivityInsert): Promise<void> {
  const { error } = await supabase.from("activities").insert(activity);
  if (error) throw error;
}

/** Attività pending assegnate a un agente esecutore (Coda AI). */
export async function findPendingAgentActivities(userId: string, limit = 100): Promise<AllActivity[]> {
  const { data, error } = await supabase
    .from("activities")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "pending")
    .not("executed_by_agent_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as unknown as AllActivity[];
}

export async function rejectActivity(id: string) {
  const { error } = await supabase
    .from("activities")
    .update({ status: "cancelled" as Database["public"]["Enums"]["activity_status"], reviewed: true })
    .eq("id", id);
  if (error) throw error;
}

export interface ContactTimelineActivityRow {
  id: string;
  activity_type: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
  response_received: boolean | null;
}

/** Attività collegate a un contatto selezionato, per la timeline. */
export async function findActivitiesForSelectedContact(
  contactId: string,
  from: number,
  to: number,
): Promise<ContactTimelineActivityRow[]> {
  const { data, error } = await supabase
    .from("activities")
    .select("id, activity_type, title, description, status, created_at, response_received")
    .eq("selected_contact_id", contactId)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw error;
  return (data || []) as unknown as ContactTimelineActivityRow[];
}

export interface RecordActivityRow {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  scheduled_at: string | null;
}

/** Attività per source_id (Circuito di Attesa nel drawer contatto). */
export async function findActivitiesForSourceId(sourceId: string, limit = 20): Promise<RecordActivityRow[]> {
  const { data, error } = await supabase
    .from("activities")
    .select("*")
    .eq("source_id", sourceId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as unknown as RecordActivityRow[];
}

/**
 * Salva subject/body generati come bozza email sull'activity, pronta a
 * comparire in Sorting. Estratto da `useEmailGenerator`.
 */
export async function updateActivityEmailDraft(
  activityId: string,
  patch: { email_subject: string; email_body: string; scheduled_at: string; status: string },
): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase
    .from("activities")
    .update(patch)
    .eq("id", activityId);
  return { error };
}

export interface TodayActivityRow {
  id: string;
  activity_type: string;
  title: string;
  source_id: string;
  source_type: string;
  description: string | null;
  completed_at: string | null;
  source_meta: unknown;
  status: string;
}

/** Attività di oggi (pending/in_progress/completed), estratto da `useTodayActivities`. */
export async function findTodayActivities(sinceIso: string): Promise<TodayActivityRow[]> {
  const { data, error } = await supabase
    .from("activities")
    .select("id, activity_type, title, source_id, source_type, description, completed_at, source_meta, status")
    .gte("created_at", sinceIso)
    .is("deleted_at", null)
    .in("status", ["pending", "in_progress", "completed"] as Array<"pending" | "in_progress" | "completed">)
    .order("completed_at", { ascending: false, nullsFirst: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as unknown as TodayActivityRow[];
}
