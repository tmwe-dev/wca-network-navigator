/**
 * DAL — Holding pattern (liste + timeline).
 * Estratto da `useHoldingPattern` durante la campagna DAL.
 */
import { supabase } from "@/integrations/supabase/client";

export interface HoldingProspectRow {
  id: string;
  company_name: string;
  city: string | null;
  email: string | null;
  lead_status: string;
  last_interaction_at: string | null;
  interaction_count: number;
}

export interface HoldingContactRow extends HoldingProspectRow {
  name: string | null;
  country: string | null;
}

export async function findHoldingProspects(statuses: string[], limit = 200): Promise<HoldingProspectRow[]> {
  const { data } = await supabase
    .from("prospects")
    .select("id, company_name, city, email, lead_status, last_interaction_at, interaction_count")
    .in("lead_status", statuses)
    .order("last_interaction_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  return (data ?? []) as HoldingProspectRow[];
}

export async function findHoldingImportedContacts(statuses: string[], limit = 200): Promise<HoldingContactRow[]> {
  const { data } = await supabase
    .from("imported_contacts")
    .select("id, company_name, name, city, email, lead_status, last_interaction_at, interaction_count, country")
    .in("lead_status", statuses)
    .order("last_interaction_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  return (data ?? []) as HoldingContactRow[];
}

export interface HoldingActivityRef {
  source_id: string;
  user_id: string | null;
  executed_by_agent_id: string | null;
}

export async function findRecentActivityRefs(sourceIds: string[], limit = 200): Promise<HoldingActivityRef[]> {
  if (sourceIds.length === 0) return [];
  const { data } = await supabase
    .from("activities")
    .select("source_id, user_id, executed_by_agent_id")
    .in("source_id", sourceIds)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as HoldingActivityRef[];
}

export async function findProfileNames(userIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (userIds.length === 0) return map;
  const { data } = await supabase.from("profiles").select("user_id, display_name").in("user_id", userIds);
  (data ?? []).forEach((p) => map.set(p.user_id, p.display_name || "Operatore"));
  return map;
}

export async function findAgentBadges(agentIds: string[]): Promise<Map<string, { emoji: string; name: string }>> {
  const map = new Map<string, { emoji: string; name: string }>();
  if (agentIds.length === 0) return map;
  const { data } = await supabase.from("agents").select("id, avatar_emoji, name").in("id", agentIds);
  (data ?? []).forEach((a) => map.set(a.id, { emoji: a.avatar_emoji, name: a.name }));
  return map;
}

export interface PartnerTimelineData {
  activities: Array<{ id: string; created_at: string; activity_type: string; title: string; description: string | null; status: string | null }>;
  interactions: Array<{ id: string; created_at: string | null; interaction_type: string; subject: string; notes: string | null }>;
  emails: Array<{ id: string; sent_at: string | null; subject: string; recipient_email: string; status: string }>;
}

export async function findPartnerTimeline(partnerId: string, limit = 50): Promise<PartnerTimelineData> {
  const [acts, ints, emails] = await Promise.all([
    supabase
      .from("activities")
      .select("id, created_at, activity_type, title, description, status")
      .or(`partner_id.eq.${partnerId},source_id.eq.${partnerId}`)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("interactions")
      .select("id, created_at, interaction_type, subject, notes")
      .eq("partner_id", partnerId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("email_campaign_queue")
      .select("id, sent_at, subject, recipient_email, status")
      .eq("partner_id", partnerId)
      .eq("status", "sent")
      .order("sent_at", { ascending: false })
      .limit(limit),
  ]);
  return {
    activities: (acts.data ?? []) as PartnerTimelineData["activities"],
    interactions: (ints.data ?? []) as PartnerTimelineData["interactions"],
    emails: (emails.data ?? []) as PartnerTimelineData["emails"],
  };
}

export interface TimelineInteractionRow {
  id: string;
  created_at: string;
  interaction_type: string;
  title: string;
  description: string | null;
  outcome: string | null;
}

export async function findProspectInteractionsTimeline(prospectId: string, limit = 50): Promise<TimelineInteractionRow[]> {
  const { data } = await supabase
    .from("prospect_interactions")
    .select("id, created_at, interaction_type, title, description, outcome")
    .eq("prospect_id", prospectId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as TimelineInteractionRow[];
}

export async function findContactInteractionsTimeline(contactId: string, limit = 50): Promise<TimelineInteractionRow[]> {
  const { data } = await supabase
    .from("contact_interactions")
    .select("id, created_at, interaction_type, title, description, outcome")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as TimelineInteractionRow[];
}
