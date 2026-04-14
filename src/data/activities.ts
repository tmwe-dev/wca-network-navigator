/**
 * Data Access Layer — Activities
 * Single source of truth for all activities table queries.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { QueryClient } from "@tanstack/react-query";

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
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Activity[];
}

export async function findAllActivities(limit = 1000): Promise<AllActivity[]> {
  const { data, error } = await supabase
    .from("activities")
    .select(ALL_ACTIVITIES_SELECT)
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

export async function deleteActivities(ids: string[]) {
  const { error } = await supabase
    .from("activities")
    .delete()
    .in("id", ids);
  if (error) throw error;
}

export async function insertActivity(activity: ActivityInsert) {
  const { error } = await supabase.from("activities").insert(activity);
  if (error) throw error;
}

export async function countActivitiesWithNullPartner() {
  const { count, error } = await supabase.from("activities").select("*", { count: "exact", head: true }).is("partner_id", null);
  if (error) throw error;
  return count ?? 0;
}

export async function approveActivity(id: string) {
  const { error } = await supabase.from("activities").update({ status: "approved" as Database["public"]["Enums"]["activity_status"], reviewed: true }).eq("id", id);
  if (error) throw error;
}

// ─── Cache Invalidation ────────────────────────────────
export function invalidateActivityCache(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: activityKeys.all });
  qc.invalidateQueries({ queryKey: ["activities"] });
}
