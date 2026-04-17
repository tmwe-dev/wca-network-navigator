/**
 * useDashboardData — Consolidated dashboard hook
 * ⚡ Perf: ora effettua UNA sola chiamata RPC `get_dashboard_snapshot`
 * invece di 12 query parallele. 12 round-trip → 1.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import type { OperativeMetrics } from "@/v2/io/supabase/queries/dashboard";
import type { AgentTaskBreakdown } from "@/v2/io/supabase/queries/dashboard";
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

interface RpcSnapshot {
  total_partners: number;
  total_contacts: number;
  new_partners: number;
  new_contacts: number;
  contacted_partners: number;
  contacted_contacts: number;
  replied_activities: number;
  schedules_active: number;
  schedules_pending: number;
  actions_approved: number;
  actions_proposed: number;
  sent_today: number;
  awaiting_reply: number;
  replies_received: number;
  unread_emails: number;
  proposed_tasks: number;
  draft_emails: number;
  pending_outreach: number;
  active_jobs: number;
  partner_count: number;
  ready_contacts_count: number;
  open_activities_count: number;
  prospect_total: number;
  agent_breakdowns: ReadonlyArray<{
    agent_id: string;
    proposed: number;
    running: number;
    pending: number;
    completed_today: number;
  }>;
}

async function fetchDashboardData(): Promise<DashboardData> {
  // Single RPC call replaces the previous 12-query Promise.all.
  // Cast through unknown — the snapshot RPC is not in the generated types yet.
  const { data, error } = await (supabase.rpc as unknown as (
    fn: string
  ) => Promise<{ data: RpcSnapshot | null; error: { message: string } | null }>)(
    "get_dashboard_snapshot"
  );

  if (error || !data) {
    return EMPTY;
  }

  const opMetrics: OperativeMetrics = {
    contacts: {
      total: data.total_partners + data.total_contacts,
      toContact: data.new_partners + data.new_contacts,
      contacted: data.contacted_partners + data.contacted_contacts,
      replied: data.replied_activities,
    },
    outreach: {
      created: data.schedules_active,
      scheduled: data.schedules_pending,
      authorized: data.actions_approved,
      pendingApproval: data.actions_proposed,
    },
    messages: {
      sentToday: data.sent_today,
      awaitingReply: data.awaiting_reply,
      repliesReceived: data.replies_received,
    },
  };

  const breakdowns: AgentTaskBreakdown[] = data.agent_breakdowns.map((b) => ({
    agentId: b.agent_id,
    proposed: b.proposed,
    running: b.running,
    pending: b.pending,
    completedToday: b.completed_today,
  }));

  // Build suggestions (ordered by priority).
  const suggestions: SmartSuggestion[] = [];

  if (data.unread_emails > 0) {
    suggestions.push({ id: "unread-emails", icon: "📨", label: `${data.unread_emails} email da leggere`, description: "Analizza e classifica le email in arrivo", route: "/v2/inreach", count: data.unread_emails, priority: 100 });
  }
  if (data.proposed_tasks > 0) {
    suggestions.push({ id: "proposed-tasks", icon: "🤖", label: `${data.proposed_tasks} task agente da confermare`, description: "Approva o modifica i task proposti dagli agenti", route: "/v2/agent-tasks", count: data.proposed_tasks, priority: 95 });
  }
  if (data.actions_proposed > 0) {
    suggestions.push({ id: "pending-approval", icon: "✅", label: `${data.actions_proposed} azioni da autorizzare`, description: "Approva le azioni programmate dalle missioni", route: "/v2/outreach", count: data.actions_proposed, priority: 90 });
  }
  if (data.draft_emails > 0) {
    suggestions.push({ id: "draft-emails", icon: "✏️", label: `${data.draft_emails} bozze email da rivedere`, description: "Rivedi e invia le email in bozza", route: "/v2/outreach", count: data.draft_emails, priority: 85 });
  }
  if (data.pending_outreach > 0) {
    suggestions.push({ id: "pending-outreach", icon: "📤", label: `${data.pending_outreach} outreach programmati`, description: "Verifica le comunicazioni in coda", route: "/v2/outreach", count: data.pending_outreach, priority: 80 });
  }
  if (data.active_jobs > 0) {
    suggestions.push({ id: "active-jobs", icon: "⚙️", label: `${data.active_jobs} job attivi`, description: "Monitora i download e le operazioni in corso", route: "/v2/network", count: data.active_jobs, priority: 70 });
  }
  if (suggestions.length === 0) {
    suggestions.push({ id: "explore", icon: "🔍", label: "Esplora il network", description: "Naviga i partner WCA e i contatti", route: "/v2/network", count: 0, priority: 10 });
  }

  suggestions.sort((a, b) => b.priority - a.priority);

  return {
    operativeMetrics: opMetrics,
    suggestions: suggestions.slice(0, 5),
    agentBreakdowns: breakdowns,
    partnerCount: data.partner_count,
    readyContactsCount: data.ready_contacts_count,
    openActivitiesCount: data.open_activities_count,
    prospectTotal: data.prospect_total,
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
