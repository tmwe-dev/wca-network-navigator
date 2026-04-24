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
    // P3.7: v_kpi_dashboard non esiste. Count diretto su partners.
    const [partnersRes, contactsRes, activitiesRes, agentsRes, campaignRes, draftsRes] = await Promise.all([
      supabase.from("partners").select("id", { count: "exact", head: true }).is("deleted_at", null),
      supabase.from("imported_contacts").select("id", { count: "exact", head: true }),
      supabase.from("activities").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("agents").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("campaign_jobs").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("email_drafts").select("id", { count: "exact", head: true }).eq("status", "draft"),
    ]);

    const firstError = [partnersRes, contactsRes, activitiesRes, agentsRes, campaignRes, draftsRes]
      .find((r) => r.error);

    if (firstError?.error) {
      return err(ioError("DATABASE_ERROR", firstError.error.message, {
        table: "dashboard_counts",
      }, "fetchDashboardCounts"));
    }

    return ok({
      partners: partnersRes.count ?? 0,
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

    // P3.7: v_kpi_dashboard non esiste — count diretti su partners + altre tabelle.
    const [
      partnersTotalRes,
      partnersNewRes,
      partnersFirstTouchRes,
      outreachSentTodayRes,
      totalContactsRes,
      newContactsRes,
      contactedContactsRes,
      repliedRes,
      schedulesAllRes,
      schedulesPendingRes,
      actionsApprovedRes,
      actionsProposedRes,
      awaitingRes,
      repliesReceivedRes,
    ] = await Promise.all([
      supabase.from("partners").select("id", { count: "exact", head: true }).is("deleted_at", null),
      supabase.from("partners").select("id", { count: "exact", head: true }).is("deleted_at", null).eq("lead_status", "new"),
      supabase.from("partners").select("id", { count: "exact", head: true }).is("deleted_at", null).eq("lead_status", "first_touch_sent"),
      supabase.from("outreach_queue").select("id", { count: "exact", head: true }).eq("status", "sent").gte("updated_at", todayISO),
      supabase.from("imported_contacts").select("id", { count: "exact", head: true }),
      supabase.from("imported_contacts").select("id", { count: "exact", head: true }).eq("lead_status", "new"),
      supabase.from("imported_contacts").select("id", { count: "exact", head: true }).eq("lead_status", "first_touch_sent"),
      supabase.from("activities").select("id", { count: "exact", head: true }).eq("response_received", true),
      supabase.from("outreach_schedules").select("id", { count: "exact", head: true }).in("status", ["pending", "approved", "running"]),
      supabase.from("outreach_schedules").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("mission_actions").select("id", { count: "exact", head: true }).eq("status", "approved"),
      supabase.from("mission_actions").select("id", { count: "exact", head: true }).eq("status", "proposed"),
      supabase.from("outreach_queue").select("id", { count: "exact", head: true }).eq("status", "sent"),
      supabase.from("outreach_queue").select("id", { count: "exact", head: true }).eq("status", "replied"),
    ]);

    const allRes = [
      partnersTotalRes, partnersNewRes, partnersFirstTouchRes, outreachSentTodayRes,
      totalContactsRes, newContactsRes, contactedContactsRes, repliedRes,
      schedulesAllRes, schedulesPendingRes, actionsApprovedRes, actionsProposedRes,
      awaitingRes, repliesReceivedRes,
    ];
    const firstErr = allRes.find((r) => r.error);
    if (firstErr?.error) {
      return err(ioError("DATABASE_ERROR", firstErr.error.message, { table: "operative_metrics" }, "fetchOperativeMetrics"));
    }

    return ok({
      contacts: {
        total: (partnersTotalRes.count ?? 0) + (totalContactsRes.count ?? 0),
        toContact: (partnersNewRes.count ?? 0) + (newContactsRes.count ?? 0),
        contacted: (partnersFirstTouchRes.count ?? 0) + (contactedContactsRes.count ?? 0),
        replied: repliedRes.count ?? 0,
      },
      outreach: {
        created: schedulesAllRes.count ?? 0,
        scheduled: schedulesPendingRes.count ?? 0,
        authorized: actionsApprovedRes.count ?? 0,
        pendingApproval: actionsProposedRes.count ?? 0,
      },
      messages: {
        sentToday: outreachSentTodayRes.count ?? 0,
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
