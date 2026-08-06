/**
 * DAL — Smart Suggestions counts
 *
 * Aggregatore READ-only per il pannello suggerimenti. Consolida 6 count()
 * head-only precedentemente inline in `useSmartSuggestions` (D1 dbypass
 * cleanup). Nessuna scrittura, RLS applicata dall'utente autenticato.
 */
import { supabase } from "@/integrations/supabase/client";

export interface SmartSuggestionCounts {
  readonly pendingTasks: number;
  readonly unreadInboundMessages: number;
  readonly pendingApproval: number;
  readonly pendingOutreach: number;
  readonly draftEmails: number;
  readonly activeJobs: number;
}

function n(count: number | null | undefined): number {
  return count ?? 0;
}

export async function fetchSmartSuggestionCounts(): Promise<SmartSuggestionCounts> {
  const [pendingTasksRes, unreadEmailsRes, pendingApprovalRes, pendingOutreachRes, draftEmailsRes, activeJobsRes] =
    await Promise.all([
      supabase.from("agent_tasks").select("id", { count: "exact", head: true }).eq("status", "proposed"),
      supabase
        .from("channel_messages")
        .select("id", { count: "exact", head: true })
        .eq("direction", "inbound")
        .is("read_at", null),
      supabase.from("mission_actions").select("id", { count: "exact", head: true }).in("status", ["proposed"]),
      supabase.from("outreach_schedules").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("email_drafts").select("id", { count: "exact", head: true }).eq("status", "draft"),
      supabase.from("download_jobs").select("id", { count: "exact", head: true }).in("status", ["pending", "running"]),
    ]);

  // Propaga eventuali errori auth/RLS/network — non mascherare.
  const firstError =
    pendingTasksRes.error ??
    unreadEmailsRes.error ??
    pendingApprovalRes.error ??
    pendingOutreachRes.error ??
    draftEmailsRes.error ??
    activeJobsRes.error;
  if (firstError) throw firstError;

  return {
    pendingTasks: n(pendingTasksRes.count),
    unreadInboundMessages: n(unreadEmailsRes.count),
    pendingApproval: n(pendingApprovalRes.count),
    pendingOutreach: n(pendingOutreachRes.count),
    draftEmails: n(draftEmailsRes.count),
    activeJobs: n(activeJobsRes.count),
  };
}
