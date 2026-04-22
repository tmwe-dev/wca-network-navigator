/**
 * useAuditTrail — Hook for querying supervisor_audit_log with filters and pagination.
 * LOVABLE-93: audit trail viewer
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

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

function useAuditTrail(filters: AuditTrailFilters) {
  return useQuery({
    queryKey: queryKeys.supervisor.feed(
      filters.actorType || "all",
      filters.actionCategory || "all",
      filters.searchText || "",
      Math.floor(filters.offset / filters.limit)
    ),
    queryFn: async () => {
      let query = supabase
        .from("supervisor_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .range(filters.offset, filters.offset + filters.limit - 1);

      // Apply filters
      if (filters.actorType && filters.actorType !== "all") {
        query = query.eq("actor_type", filters.actorType);
      }

      if (filters.actionCategory && filters.actionCategory !== "all") {
        query = query.eq("action_category", filters.actionCategory);
      }

      if (filters.dateRange) {
        query = query
          .gte("created_at", filters.dateRange.from)
          .lte("created_at", filters.dateRange.to);
      }

      if (filters.domain) {
        query = query.eq("email_address", filters.domain);
      }

      if (filters.searchText && filters.searchText.trim()) {
        const searchTerm = `%${filters.searchText.trim()}%`;
        query = query.or(
          `target_label.ilike.${searchTerm},action_detail.ilike.${searchTerm},email_address.ilike.${searchTerm}`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as AuditTrailRow[];
    },
    refetchInterval: 15000,
    staleTime: 5000,
  });
}

function useAuditTrailCount(filters: Omit<AuditTrailFilters, "offset" | "limit">) {
  return useQuery({
    queryKey: ["audit-trail-count", filters],
    queryFn: async () => {
      let query = supabase
        .from("supervisor_audit_log")
        .select("id", { count: "exact" });

      if (filters.actorType && filters.actorType !== "all") {
        query = query.eq("actor_type", filters.actorType);
      }

      if (filters.actionCategory && filters.actionCategory !== "all") {
        query = query.eq("action_category", filters.actionCategory);
      }

      if (filters.dateRange) {
        query = query
          .gte("created_at", filters.dateRange.from)
          .lte("created_at", filters.dateRange.to);
      }

      if (filters.domain) {
        query = query.eq("email_address", filters.domain);
      }

      if (filters.searchText && filters.searchText.trim()) {
        const searchTerm = `%${filters.searchText.trim()}%`;
        query = query.or(
          `target_label.ilike.${searchTerm},action_detail.ilike.${searchTerm},email_address.ilike.${searchTerm}`
        );
      }

      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },
    staleTime: 10000,
  });
}
