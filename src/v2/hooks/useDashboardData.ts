/**
 * useDashboardData — Consolidated dashboard hook
 * Merges operativeMetrics + smartSuggestions + misc counts into ONE query.
 * Eliminates ~15 redundant DB calls on dashboard mount.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import type { OperativeMetrics } from "@/v2/io/supabase/queries/dashboard";
import { fetchOperativeMetrics, fetchAgentTaskBreakdowns, type AgentTaskBreakdown } from "@/v2/io/supabase/queries/dashboard";
import type { SmartSuggestion } from "./useSmartSuggestions";

export interface DashboardData {
  readonly operativeMetrics: OperativeMetrics | null;
  readonly suggestions: readonly SmartSuggestion[];
  readonly agentBreakdowns: readonly AgentTaskBreakdown[];
  readonly partnerCount: number;
  readonly readyContactsCount: number;
  readonly openActivitiesCount: number;
  readonly prospectTotal: number;
}

const EMPTY: DashboardData = {
  operativeMetrics: null,
  suggestions: [],
  agentBreakdowns: [],
  partnerCount: 0,
  readyContactsCount: 0,
  openActivitiesCount: 0,
  prospectTotal: 0,
};

async function fetchDashboardData(): Promise<DashboardData> {
  // Single Promise.all for everything
  const [
    opResult,
    breakdownResult,
    // Extra counts not in operativeMetrics
    partnerCountRes,
    readyContactsRes,
    openActivitiesRes,
    prospectRes,
    // SmartSuggestion-specific counts (not in opMetrics)
    unreadEmailsRes,
    proposedTasksRes,
    draftEmailsRes,
    pendingOutreachRes,
    activeJobsRes,
    pendingApprovalRes,
  ] = await Promise.all([
    fetchOperativeMetrics(),
    fetchAgentTaskBreakdowns(),
    // Partner count
    supabase.from("partners").select("id", { count: "exact", head: true }),
    // Ready contacts (cockpit replacement — just count contacts with email)
    supabase.from("cockpit_queue").select("id", { count: "exact", head: true }).eq("status", "ready"),
    // Open activities count (replaces useAllActivities)
    supabase.from("activities").select("id", { count: "exact", head: true }).in("status", ["pending", "in_progress", "scheduled"]),
    // Prospect total
    supabase.from("imported_contacts").select("id", { count: "exact", head: true }),
    // Smart suggestions counts
    supabase.from("channel_messages").select("id", { count: "exact", head: true }).eq("direction", "inbound").is("read_at", null),
    supabase.from("agent_tasks").select("id", { count: "exact", head: true }).eq("status", "proposed"),
    supabase.from("email_drafts").select("id", { count: "exact", head: true }).eq("status", "draft"),
    supabase.from("outreach_schedules").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("download_jobs").select("id", { count: "exact", head: true }).in("status", ["pending", "running"]),
    supabase.from("mission_actions").select("id", { count: "exact", head: true }).eq("status", "proposed"),
  ]);

  const opMetrics = opResult._tag === "Ok" ? opResult.value : null;
  const breakdowns = breakdownResult._tag === "Ok" ? breakdownResult.value : [];

  // Build suggestions from counts
  const suggestions: SmartSuggestion[] = [];

  const unread = unreadEmailsRes.count ?? 0;
  if (unread > 0) {
    suggestions.push({ id: "unread-emails", icon: "📨", label: `${unread} email da leggere`, description: "Analizza e classifica le email in arrivo", route: "/v2/inreach", count: unread, priority: 100 });
  }

  const proposed = proposedTasksRes.count ?? 0;
  if (proposed > 0) {
    suggestions.push({ id: "proposed-tasks", icon: "🤖", label: `${proposed} task agente da confermare`, description: "Approva o modifica i task proposti dagli agenti", route: "/v2/agent-tasks", count: proposed, priority: 95 });
  }

  const approval = pendingApprovalRes.count ?? 0;
  if (approval > 0) {
    suggestions.push({ id: "pending-approval", icon: "✅", label: `${approval} azioni da autorizzare`, description: "Approva le azioni programmate dalle missioni", route: "/v2/outreach", count: approval, priority: 90 });
  }

  const drafts = draftEmailsRes.count ?? 0;
  if (drafts > 0) {
    suggestions.push({ id: "draft-emails", icon: "✏️", label: `${drafts} bozze email da rivedere`, description: "Rivedi e invia le email in bozza", route: "/v2/outreach", count: drafts, priority: 85 });
  }

  const pending = pendingOutreachRes.count ?? 0;
  if (pending > 0) {
    suggestions.push({ id: "pending-outreach", icon: "📤", label: `${pending} outreach programmati`, description: "Verifica le comunicazioni in coda", route: "/v2/outreach", count: pending, priority: 80 });
  }

  const jobs = activeJobsRes.count ?? 0;
  if (jobs > 0) {
    suggestions.push({ id: "active-jobs", icon: "⚙️", label: `${jobs} job attivi`, description: "Monitora i download e le operazioni in corso", route: "/v2/network", count: jobs, priority: 70 });
  }

  if (suggestions.length === 0) {
    suggestions.push({ id: "explore", icon: "🔍", label: "Esplora il network", description: "Naviga i partner WCA e i contatti", route: "/v2/network", count: 0, priority: 10 });
  }

  suggestions.sort((a, b) => b.priority - a.priority);

  return {
    operativeMetrics: opMetrics,
    suggestions: suggestions.slice(0, 5),
    agentBreakdowns: breakdowns,
    partnerCount: partnerCountRes.count ?? 0,
    readyContactsCount: readyContactsRes.count ?? 0,
    openActivitiesCount: openActivitiesRes.count ?? 0,
    prospectTotal: prospectRes.count ?? 0,
  };
}

export function useDashboardData() {
  return useQuery({
    queryKey: queryKeys.v2.dashboard,
    queryFn: fetchDashboardData,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
