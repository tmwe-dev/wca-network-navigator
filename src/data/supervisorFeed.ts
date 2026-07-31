/**
 * DAL — supervisor_audit_log: KPI e feed paginato (SupervisorFeedPanel).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AuditRow = Database["public"]["Tables"]["supervisor_audit_log"]["Row"];

export interface SupervisorKpis {
  total: number;
  aiAuto: number;
  approved: number;
  manual: number;
}

/** KPI giornalieri sul decision_origin da una data. */
export async function findSupervisorKpisSince(sinceIso: string): Promise<SupervisorKpis> {
  const { data, error } = await supabase
    .from("supervisor_audit_log")
    .select("decision_origin", { count: "exact" })
    .gte("created_at", sinceIso);
  if (error) throw error;
  const rows = (data || []) as { decision_origin: string }[];
  return {
    total: rows.length,
    aiAuto: rows.filter((r) => r.decision_origin === "ai_auto").length,
    approved: rows.filter((r) => r.decision_origin === "ai_approved").length,
    manual: rows.filter((r) => r.decision_origin === "manual").length,
  };
}

export interface SupervisorFeedFilters {
  actorFilter: string;
  originFilter: string;
  search: string;
  page: number;
  pageSize: number;
}

/** Feed paginato con filtri per attore, origine e ricerca testuale. */
export async function findSupervisorFeed(filters: SupervisorFeedFilters): Promise<AuditRow[]> {
  const { actorFilter, originFilter, search, page, pageSize } = filters;
  let q = supabase
    .from("supervisor_audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (actorFilter !== "all") q = q.eq("actor_type", actorFilter);
  if (originFilter !== "all") q = q.eq("decision_origin", originFilter);
  if (search.trim()) {
    q = q.or(`email_address.ilike.%${search}%,action_detail.ilike.%${search}%,target_label.ilike.%${search}%`);
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as AuditRow[];
}
