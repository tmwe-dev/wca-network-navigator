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
    const [partnersRes, contactsRes, activitiesRes, agentsRes, campaignRes, draftsRes] = await Promise.all([
      supabase.from("partners").select("id", { count: "exact", head: true }),
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
