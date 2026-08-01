/**
 * DAL helpers for outreach unified views
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type _ActivityStatus = Database["public"]["Enums"]["activity_status"];
type _ActivityType = Database["public"]["Enums"]["activity_type"];
type ActivityUpdate = Database["public"]["Tables"]["activities"]["Update"];
type MissionActionUpdate = Database["public"]["Tables"]["mission_actions"]["Update"];

// ── Pending items (Da Inviare) ──
export async function findPendingOutreach() {
  const { data: { session: __s } } = await supabase.auth.getSession(); const user = __s?.user ?? null;
  if (!user) return { activities: [], missionActions: [], pendingActions: [] };

  const [actRes, maRes, paRes] = await Promise.all([
    supabase.from("activities")
      .select("*, partners(company_name, country_code, logo_url)")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .in("activity_type", ["send_email"])
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
  const { data: { session: __s } } = await supabase.auth.getSession(); const user = __s?.user ?? null;
  if (!user) return { activities: [], missionActions: [] };

  const [actRes, maRes] = await Promise.all([
    supabase.from("activities")
      .select("*, partners(company_name, country_code, logo_url)")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .in("activity_type", ["send_email"])
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
  const { data: { session: __s } } = await supabase.auth.getSession(); const user = __s?.user ?? null;
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
  const { data: { session: __s } } = await supabase.auth.getSession(); const user = __s?.user ?? null;
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
  const { data: { session: __s } } = await supabase.auth.getSession(); const user = __s?.user ?? null;
  if (!user) return { pending: 0, sentToday: 0, scheduled: 0, awaitingResponse: 0, failed: 0 };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const now = new Date().toISOString();

  // P3.7: v_outreach_today non esiste — count diretti su activities/mission_actions.
  const [pendingRes, sentRes, scheduledRes, failedRes, sentRecentRes] = await Promise.all([
    supabase.from("activities").select("id", { count: "exact", head: true })
      .eq("user_id", user.id).eq("status", "pending").in("activity_type", ["send_email"]),
    supabase.from("activities").select("id", { count: "exact", head: true })
      .eq("user_id", user.id).eq("status", "completed").in("activity_type", ["send_email"])
      .gte("completed_at", todayStart.toISOString()),
    supabase.from("mission_actions").select("id", { count: "exact", head: true })
      .eq("user_id", user.id).in("status", ["planned", "approved"]).gt("scheduled_at", now),
    supabase.from("mission_actions").select("id", { count: "exact", head: true })
      .eq("user_id", user.id).eq("status", "failed"),
    supabase.from("activities").select("id", { count: "exact", head: true })
      .eq("user_id", user.id).eq("status", "completed").in("activity_type", ["send_email"])
      .gte("completed_at", new Date(Date.now() - 7 * 86400000).toISOString()),
  ]);

  return {
    pending: pendingRes.count ?? 0,
    sentToday: sentRes.count ?? 0,
    scheduled: scheduledRes.count ?? 0,
    awaitingResponse: sentRecentRes.count ?? 0,
    failed: failedRes.count ?? 0,
  };
}

// ── Mutations ──
export async function updateActivitySchedule(id: string, scheduledAt: string) {
  const { error } = await supabase.from("activities").update({ scheduled_at: scheduledAt } satisfies ActivityUpdate).eq("id", id);
  if (error) throw error;
}

export async function cancelActivity(id: string) {
  const { error } = await supabase.from("activities").update({ status: "cancelled" } satisfies ActivityUpdate).eq("id", id);
  if (error) throw error;
}

export async function cancelMissionAction(id: string) {
  const { error } = await supabase.from("mission_actions").update({ status: "cancelled" } satisfies MissionActionUpdate).eq("id", id);
  if (error) throw error;
}

export async function retryMissionAction(id: string) {
  const { error } = await supabase.from("mission_actions")
    .update({ status: "planned", retry_count: 0, last_error: null } satisfies MissionActionUpdate)
    .eq("id", id);
  if (error) throw error;
}

export async function updateMissionActionSchedule(id: string, scheduledAt: string) {
  const { error } = await supabase.from("mission_actions").update({ scheduled_at: scheduledAt } satisfies MissionActionUpdate).eq("id", id);
  if (error) throw error;
}

export async function cancelPendingAction(id: string) {
  const { error } = await supabase.from("ai_pending_actions").update({ status: "rejected" }).eq("id", id);
  if (error) throw error;
}

// ── Mission controls ──
export async function pauseMission(missionId: string) {
  const { error: e1 } = await supabase.from("outreach_missions")
    .update({ status: "paused" }).eq("id", missionId);
  if (e1) throw e1;
  const { error: e2 } = await supabase.from("mission_actions")
    .update({ status: "paused" } satisfies MissionActionUpdate).eq("mission_id", missionId).in("status", ["planned", "approved"]);
  if (e2) throw e2;
}

export async function resumeMission(missionId: string) {
  const { error: e1 } = await supabase.from("outreach_missions")
    .update({ status: "in_progress" }).eq("id", missionId);
  if (e1) throw e1;
  const { error: e2 } = await supabase.from("mission_actions")
    .update({ status: "approved" } satisfies MissionActionUpdate).eq("mission_id", missionId).eq("status", "paused");
  if (e2) throw e2;
}

export async function cancelMission(missionId: string) {
  const { error: e1 } = await supabase.from("outreach_missions")
    .update({ status: "cancelled" }).eq("id", missionId);
  if (e1) throw e1;
  const { error: e2 } = await supabase.from("mission_actions")
    .update({ status: "cancelled" } satisfies MissionActionUpdate).eq("mission_id", missionId).in("status", ["planned", "approved", "paused"]);
  if (e2) throw e2;
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
  const { data: { session: __s } } = await supabase.auth.getSession(); const user = __s?.user ?? null;
  if (!user) return;
  // supervisor_audit_log may not be in generated types yet — use dynamic access
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  await (supabase.from as Function)("supervisor_audit_log").insert({
    user_id: user.id,
    actor_type: "user",
    ...entry,
    created_at: new Date().toISOString(),
  }).then(() => {});
}

/* ── Sub-tab counts (InUscitaTab) ──
 * Estratto dal bypass DAL inline: 9 count head query in parallelo, stesse
 * tabelle, stessi filtri, stessa aggregazione.
 */
export interface OutreachSubCounts {
  pending: number;
  sent: number;
  scheduled: number;
  failed: number;
}

export async function fetchOutreachSubCounts(): Promise<OutreachSubCounts> {
  const [pending, sent, scheduled, failed, bulkPending, bulkSent, bulkScheduled, bulkFailed, sentLog] =
    await Promise.all([
      supabase.from("cockpit_queue").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("activities").select("id", { count: "exact", head: true }).eq("status", "completed").eq("activity_type", "send_email"),
      supabase.from("cockpit_queue").select("id", { count: "exact", head: true }).eq("status", "scheduled"),
      supabase.from("cockpit_queue").select("id", { count: "exact", head: true }).eq("status", "failed"),
      supabase.from("email_campaign_queue").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("email_campaign_queue").select("id", { count: "exact", head: true }).eq("status", "sent"),
      supabase.from("email_campaign_queue").select("id", { count: "exact", head: true }).in("status", ["scheduled"]).not("scheduled_at", "is", null),
      supabase.from("email_campaign_queue").select("id", { count: "exact", head: true }).eq("status", "failed"),
      supabase.from("email_send_log").select("id", { count: "exact", head: true }).eq("status", "sent").eq("send_method", "direct"),
    ]);
  return {
    pending: (pending.count || 0) + (bulkPending.count || 0),
    sent: (sent.count || 0) + (bulkSent.count || 0) + (sentLog.count || 0),
    scheduled: (scheduled.count || 0) + (bulkScheduled.count || 0),
    failed: (failed.count || 0) + (bulkFailed.count || 0),
  };
}

// ── Recent activities (AttivitaTab) ──
export async function findRecentActivities(limit = 200) {
  const { data } = await supabase
    .from("activities")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data || [];
}

export async function completeActivity(id: string) {
  const { error } = await supabase.from("activities")
    .update({ status: "completed", completed_at: new Date().toISOString() } satisfies ActivityUpdate)
    .eq("id", id);
  if (error) throw error;
}

export async function updateActivityDescription(id: string, description: string) {
  const { error } = await supabase.from("activities")
    .update({ description } satisfies ActivityUpdate)
    .eq("id", id);
  if (error) throw error;
}

// ── Bulk email queue (DaInviareSubTab) ──
export async function findPendingBulkQueue(limit = 200) {
  const { data } = await supabase
    .from("email_campaign_queue")
    .select("id, recipient_email, recipient_name, subject, html_body, status, scheduled_at, created_at, partner_id, draft_id")
    .in("status", ["pending", "sending", "scheduled"])
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function cancelBulkQueueItem(id: string) {
  const { error } = await supabase.from("email_campaign_queue").update({ status: "cancelled" }).eq("id", id);
  if (error) throw error;
}
