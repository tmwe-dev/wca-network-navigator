/**
 * useAuditTrail — Hook for querying supervisor_audit_log with filters and pagination.
 * LOVABLE-93: audit trail viewer
 */
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { findAuditTrail, countAuditTrail } from "@/data/auditTrailQueries";

// ── Types ──

interface AuditTrailFilters {
  offset: number;
  limit: number;
  actionCategory?: string;
  actorType?: string;
  dateRange?: {
    from: string;
    to: string;
  };
  domain?: string;
  searchText?: string;
}

interface AuditTrailRow {
  id: string;
  actor_type: string;
  actor_id: string | null;
  actor_name: string | null;
  action_category: string;
  action_detail: string;
  target_type: string | null;
  target_id: string | null;
  target_label: string | null;
  partner_id: string | null;
  contact_id: string | null;
  email_address: string | null;
  decision_origin: string;
  ai_decision_log_id: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  session_id: string | null;
  created_at: string;
}

// ── Hook ──

export function useAuditTrail(filters: AuditTrailFilters) {
  return useQuery({
    queryKey: queryKeys.supervisor.feed(
      filters.actorType || "all",
      filters.actionCategory || "all",
      filters.searchText || "",
      Math.floor(filters.offset / filters.limit)
    ),
    queryFn: async () => {
      return findAuditTrail(filters);
    },
    refetchInterval: 15000,
    staleTime: 5000,
  });
}

export function useAuditTrailCount(filters: Omit<AuditTrailFilters, "offset" | "limit">) {
  return useQuery({
    queryKey: ["audit-trail-count", filters],
    queryFn: async () => {
      return countAuditTrail(filters);
    },
    staleTime: 10000,
  });
}
