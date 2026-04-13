/**
 * DAL helpers for outreach unified views
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

// ── Pending items (Da Inviare) ──
export async function findPendingOutreach() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { activities: [], missionActions: [], pendingActions: [] };

  const [actRes, maRes, paRes] = await Promise.all([
    supabase.from("activities")
      .select("*, partners(company_name, country_code, logo_url)")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .in("activity_type", ["send_email", "outreach"])
      .order("scheduled_at", { ascending: true, nullsFirst: false })
      .limit(100),
    supabase.from("mission_actions")
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["planned", "approved"])
      .order("scheduled_at", { ascending: true, nullsFirst: false })
      .limit(100),
    supabase.from("ai_pending_actions")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .in("action_type", ["send_email", "send_whatsapp", "reply", "forward"])
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return {
    activities: actRes.data ?? [],
    missionActions: maRes.data ?? [],
    pendingActions: paRes.data ?? [],
  };
}

// ── Sent items (Inviati) ──
export async function findSentOutreach() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { activities: [], missionActions: [] };

  const [actRes, maRes] = await Promise.all([
    supabase.from("activities")
      .select("*, partners(company_name, country_code, logo_url)")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .in("activity_type", ["send_email", "outreach"])
      .order("completed_at", { ascending: false })
      .limit(100),
    supabase.from("mission_actions")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(100),
  ]);

  return {
    activities: actRes.data ?? [],
    missionActions: maRes.data ?? [],
  };
}

// ── Scheduled items (Programmati) ──
export async function findScheduledOutreach() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { missionActions: [], pendingActions: [], activities: [] };

  const now = new Date().toISOString();
  const [maRes, paRes, actRes] = await Promise.all([
    supabase.from("mission_actions")
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["planned", "approved"])
      .gt("scheduled_at", now)
      .order("scheduled_at", { ascending: true })
      .limit(100),
    supabase.from("ai_pending_actions")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("activities")
      .select("*, partners(company_name, country_code, logo_url)")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .gt("scheduled_at", now)
      .order("scheduled_at", { ascending: true })
      .limit(50),
  ]);

  return {
    missionActions: maRes.data ?? [],
    pendingActions: paRes.data ?? [],
    activities: actRes.data ?? [],
  };
}

// ── Failed items (Falliti) ──
export async function findFailedOutreach() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { missionActions: [], activities: [] };

  const [maRes, actRes] = await Promise.all([
    supabase.from("mission_actions")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "failed")
      .order("updated_at", { ascending: false })
      .limit(100),
    supabase.from("activities")
      .select("*, partners(company_name, country_code, logo_url)")
      .eq("user_id", user.id)
      .eq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return {
    missionActions: maRes.data ?? [],
    activities: actRes.data ?? [],
  };
}

// ── Outreach Stats ──
export async function fetchOutreachStats() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { pending: 0, sentToday: 0, scheduled: 0, awaitingResponse: 0, failed: 0 };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const now = new Date().toISOString();

  const [pendingRes, sentRes, scheduledRes, failedRes] = await Promise.all([
    supabase.from("activities").select("id", { count: "exact", head: true })
      .eq("user_id", user.id).eq("status", "pending").in("activity_type", ["send_email", "outreach"]),
    supabase.from("activities").select("id", { count: "exact", head: true })
      .eq("user_id", user.id).eq("status", "completed").in("activity_type", ["send_email", "outreach"])
      .gte("completed_at", todayStart.toISOString()),
    supabase.from("mission_actions").select("id", { count: "exact", head: true })
      .eq("user_id", user.id).in("status", ["planned", "approved"]).gt("scheduled_at", now),
    supabase.from("mission_actions").select("id", { count: "exact", head: true })
      .eq("user_id", user.id).eq("status", "failed"),
  ]);

  // Awaiting response: completed recently but no classification
  const { count: sentRecent } = await supabase.from("activities")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id).eq("status", "completed").in("activity_type", ["send_email", "outreach"])
    .gte("completed_at", new Date(Date.now() - 7 * 86400000).toISOString());

  return {
    pending: pendingRes.count ?? 0,
    sentToday: sentRes.count ?? 0,
    scheduled: scheduledRes.count ?? 0,
    awaitingResponse: sentRecent ?? 0,
    failed: failedRes.count ?? 0,
  };
}

// ── Mutations ──
export async function updateActivitySchedule(id: string, scheduledAt: string) {
  const { error } = await supabase.from("activities").update({ scheduled_at: scheduledAt } as any).eq("id", id);
  if (error) throw error;
}

export async function cancelActivity(id: string) {
  const { error } = await supabase.from("activities").update({ status: "cancelled" } as any).eq("id", id);
  if (error) throw error;
}

export async function cancelMissionAction(id: string) {
  const { error } = await supabase.from("mission_actions").update({ status: "cancelled" } as any).eq("id", id);
  if (error) throw error;
}

export async function retryMissionAction(id: string) {
  const { error } = await supabase.from("mission_actions")
    .update({ status: "planned", retry_count: 0, last_error: null } as any)
    .eq("id", id);
  if (error) throw error;
}

export async function updateMissionActionSchedule(id: string, scheduledAt: string) {
  const { error } = await supabase.from("mission_actions").update({ scheduled_at: scheduledAt } as any).eq("id", id);
  if (error) throw error;
}

export async function cancelPendingAction(id: string) {
  const { error } = await supabase.from("ai_pending_actions").update({ status: "rejected" } as any).eq("id", id);
  if (error) throw error;
}

// ── Mission controls ──
export async function pauseMission(missionId: string) {
  const { error: e1 } = await supabase.from("outreach_missions" as any)
    .update({ status: "paused" }).eq("id", missionId);
  if (e1) throw e1;
  const { error: e2 } = await supabase.from("mission_actions")
    .update({ status: "paused" as any }).eq("mission_id", missionId).in("status", ["planned", "approved"]);
  if (e2) throw e2;
}

export async function resumeMission(missionId: string) {
  const { error: e1 } = await supabase.from("outreach_missions" as any)
    .update({ status: "in_progress" }).eq("id", missionId);
  if (e1) throw e1;
  const { error: e2 } = await supabase.from("mission_actions")
    .update({ status: "approved" as any }).eq("mission_id", missionId).eq("status", "paused" as any);
  if (e2) throw e2;
}

export async function cancelMission(missionId: string) {
  const { error: e1 } = await supabase.from("outreach_missions" as any)
    .update({ status: "cancelled" }).eq("id", missionId);
  if (e1) throw e1;
  const { error: e2 } = await supabase.from("mission_actions")
    .update({ status: "cancelled" as any }).eq("mission_id", missionId).in("status", ["planned", "approved", "paused"]);
  if (e2) throw e2;
}

// ── Campaign queue controls ──
export async function pauseCampaignQueue(campaignId: string) {
  const { error } = await supabase.from("email_campaign_queue")
    .update({ status: "paused" as any })
    .eq("draft_id", campaignId).eq("status", "pending");
  if (error) throw error;
}

export async function resumeCampaignQueue(campaignId: string) {
  const { error } = await supabase.from("email_campaign_queue")
    .update({ status: "pending" })
    .eq("draft_id", campaignId).eq("status", "paused" as any);
  if (error) throw error;
}

export async function cancelCampaignQueue(campaignId: string) {
  const { error } = await supabase.from("email_campaign_queue")
    .update({ status: "cancelled" as any })
    .eq("draft_id", campaignId).in("status", ["pending", "paused"]);
  if (error) throw error;
}

export async function cancelCampaignItem(itemId: string) {
  const { error } = await supabase.from("email_campaign_queue")
    .update({ status: "cancelled" as any }).eq("id", itemId);
  if (error) throw error;
}

// ── Audit log helper (client-side) ──
export async function logAuditEntry(entry: {
  action_category: string;
  action_detail: string;
  decision_origin: string;
  target_type?: string;
  target_id?: string;
  partner_id?: string;
  metadata?: Record<string, unknown>;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("supervisor_audit_log" as any).insert({
    user_id: user.id,
    actor_type: "user",
    ...entry,
    created_at: new Date().toISOString(),
  }).then(() => {});
}
