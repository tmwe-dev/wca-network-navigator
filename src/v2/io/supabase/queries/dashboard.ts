/**
 * IO Queries: Dashboard Metrics — Result-based counts
 */
import { supabase } from "@/integrations/supabase/client";
import { type Result, ok, err } from "../../../core/domain/result";
import { ioError, fromUnknown, type AppError } from "../../../core/domain/errors";

export interface DashboardCounts {
  readonly partners: number;
  readonly contacts: number;
  readonly pendingActivities: number;
  readonly activeAgents: number;
  readonly campaignJobs: number;
  readonly emailDrafts: number;
}

export async function fetchDashboardCounts(): Promise<Result<DashboardCounts, AppError>> {
  try {
    // v_kpi_dashboard provides total_partners; other counts still need individual queries
    const [kpiRes, contactsRes, activitiesRes, agentsRes, campaignRes, draftsRes] = await Promise.all([
      // View not in generated types — cast to any.
      (supabase as any).from("v_kpi_dashboard").select("total_partners").limit(1).maybeSingle(),
      supabase.from("imported_contacts").select("id", { count: "exact", head: true }),
      supabase.from("activities").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("agents").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("campaign_jobs").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("email_drafts").select("id", { count: "exact", head: true }).eq("status", "draft"),
    ]);

    const firstError = [kpiRes, contactsRes, activitiesRes, agentsRes, campaignRes, draftsRes]
      .find((r) => r.error);

    if (firstError?.error) {
      return err(ioError("DATABASE_ERROR", firstError.error.message, {
        table: "dashboard_counts",
      }, "fetchDashboardCounts"));
    }

    return ok({
      partners: (kpiRes.data as Record<string, number> | null)?.total_partners ?? 0,
      contacts: contactsRes.count ?? 0,
      pendingActivities: activitiesRes.count ?? 0,
      activeAgents: agentsRes.count ?? 0,
      campaignJobs: campaignRes.count ?? 0,
      emailDrafts: draftsRes.count ?? 0,
    });
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "fetchDashboardCounts"));
  }
}

/* ── Operative Metrics ─────────────────────────────────── */

export interface OperativeMetrics {
  readonly contacts: {
    readonly total: number;
    readonly toContact: number;
    readonly contacted: number;
    readonly replied: number;
  };
  readonly outreach: {
    readonly created: number;
    readonly scheduled: number;
    readonly authorized: number;
    readonly pendingApproval: number;
  };
  readonly messages: {
    readonly sentToday: number;
    readonly awaitingReply: number;
    readonly repliesReceived: number;
  };
}

export async function fetchOperativeMetrics(): Promise<Result<OperativeMetrics, AppError>> {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayISO = todayStart.toISOString();

    // v_kpi_dashboard provides comprehensive pre-aggregated metrics in a single row:
    // - Partner counts by all statuses (new, first_touch, etc.)
    // - Activity stats (emails/whatsapp/linkedin sent in last 30d)
    // - Inbox stats (unread, inbound today)
    // - Outreach queue stats (pending, sent today)
    // This replaces 9+ individual COUNT queries
    const [
      kpiRes,
      // imported_contacts still need individual queries (not in materialized view)
      totalContactsRes,
      newContactsRes,
      contactedContactsRes,
      repliedRes,
      // Outreach pipeline (schedules/actions not in materialized view)
      schedulesAllRes,
      schedulesPendingRes,
      actionsApprovedRes,
      actionsProposedRes,
      // Messages (outreach queue stats from view, but verify individual counts)
      awaitingRes,
      repliesReceivedRes,
    ] = await Promise.all([
      // Single read from v_kpi_dashboard replaces 6+ partner COUNT queries
      // Columns: total_partners, partners_new, partners_first_touch, partners_holding,
      // partners_engaged, partners_qualified, partners_negotiation, partners_converted,
      // partners_archived, partners_blacklisted, plus activity/inbox/queue stats
      (supabase as any).from("v_kpi_dashboard").select("total_partners, partners_new, partners_first_touch, outreach_sent_today, outreach_queue_pending, inbound_today, unread_messages").limit(1).maybeSingle(),
      // imported_contacts
      supabase.from("imported_contacts").select("id", { count: "exact", head: true }),
      supabase.from("imported_contacts").select("id", { count: "exact", head: true }).eq("lead_status", "new"),
      supabase.from("imported_contacts").select("id", { count: "exact", head: true }).eq("lead_status", "first_touch_sent"),
      // Replied (activities with response)
      supabase.from("activities").select("id", { count: "exact", head: true }).eq("response_received", true),
      // Outreach schedules (all active)
      supabase.from("outreach_schedules").select("id", { count: "exact", head: true }).in("status", ["pending", "approved", "running"]),
      // Scheduled (pending)
      supabase.from("outreach_schedules").select("id", { count: "exact", head: true }).eq("status", "pending"),
      // Authorized
      supabase.from("mission_actions").select("id", { count: "exact", head: true }).eq("status", "approved"),
      // Pending approval
      supabase.from("mission_actions").select("id", { count: "exact", head: true }).eq("status", "proposed"),
      // Awaiting reply (sent, no reply)
      supabase.from("outreach_queue").select("id", { count: "exact", head: true }).eq("status", "sent"),
      // Replies received
      supabase.from("outreach_queue").select("id", { count: "exact", head: true }).eq("status", "replied"),
    ]);

    const allRes = [
      kpiRes, totalContactsRes, newContactsRes, contactedContactsRes, repliedRes,
      schedulesAllRes, schedulesPendingRes, actionsApprovedRes, actionsProposedRes,
      awaitingRes, repliesReceivedRes,
    ];
    const firstErr = allRes.find((r) => r.error);
    if (firstErr?.error) {
      return err(ioError("DATABASE_ERROR", firstErr.error.message, { table: "operative_metrics" }, "fetchOperativeMetrics"));
    }

    // Extract pre-aggregated partner stats from materialized view
    const kpi = (kpiRes.data ?? {}) as Record<string, number>;

    return ok({
      contacts: {
        total: (kpi.total_partners ?? 0) + (totalContactsRes.count ?? 0),
        toContact: (kpi.partners_new ?? 0) + (newContactsRes.count ?? 0),
        contacted: (kpi.partners_first_touch ?? 0) + (contactedContactsRes.count ?? 0),
        replied: repliedRes.count ?? 0,
      },
      outreach: {
        created: schedulesAllRes.count ?? 0,
        scheduled: schedulesPendingRes.count ?? 0,
        authorized: actionsApprovedRes.count ?? 0,
        pendingApproval: actionsProposedRes.count ?? 0,
      },
      messages: {
        sentToday: kpi.outreach_sent_today ?? 0,
        awaitingReply: awaitingRes.count ?? 0,
        repliesReceived: repliesReceivedRes.count ?? 0,
      },
    });
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "fetchOperativeMetrics"));
  }
}

/* ── Agent Task Breakdown ──────────────────────────────── */

export interface AgentTaskBreakdown {
  readonly agentId: string;
  readonly proposed: number;
  readonly running: number;
  readonly pending: number;
  readonly completedToday: number;
}

export async function fetchAgentTaskBreakdowns(): Promise<Result<AgentTaskBreakdown[], AppError>> {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: agents, error: agentsErr } = await supabase
      .from("agents")
      .select("id")
      .eq("is_active", true);

    if (agentsErr) {
      return err(ioError("DATABASE_ERROR", agentsErr.message, { table: "agents" }, "fetchAgentTaskBreakdowns"));
    }

    if (!agents || agents.length === 0) return ok([]);

    const { data: tasks, error: tasksErr } = await supabase
      .from("agent_tasks")
      .select("agent_id, status, completed_at")
      .in("agent_id", agents.map(a => a.id));

    if (tasksErr) {
      return err(ioError("DATABASE_ERROR", tasksErr.message, { table: "agent_tasks" }, "fetchAgentTaskBreakdowns"));
    }

    const breakdowns: AgentTaskBreakdown[] = agents.map(agent => {
      const agentTasks = (tasks ?? []).filter(t => t.agent_id === agent.id);
      return {
        agentId: agent.id,
        proposed: agentTasks.filter(t => t.status === "proposed").length,
        running: agentTasks.filter(t => t.status === "running").length,
        pending: agentTasks.filter(t => t.status === "pending").length,
        completedToday: agentTasks.filter(t =>
          t.status === "completed" && t.completed_at && t.completed_at >= todayStart.toISOString()
        ).length,
      };
    });

    return ok(breakdowns);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "fetchAgentTaskBreakdowns"));
  }
}
