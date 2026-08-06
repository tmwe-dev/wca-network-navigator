import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { queryKeys } from "@/lib/queryKeys";
import {
  findAllClientAssignmentsForUser,
  findClientAssignmentsByAgent,
  findClientAssignment,
  insertClientAssignmentReturning,
} from "@/data/clientAssignments";

type ClientAssignmentRow = Database["public"]["Tables"]["client_assignments"]["Row"];

export type ClientAssignment = ClientAssignmentRow;

const QUERY_KEY = ["client-assignments"] as const;

/** Load all assignments for the current user (single query, cached) */
export function useClientAssignments() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const {
        data: { session: __s },
      } = await supabase.auth.getSession();
      const user = __s?.user ?? null;
      if (!user) return [];
      return findAllClientAssignmentsForUser(user.id);
    },
    staleTime: 5 * 60_000,
  });
}

/** Build a map source_id → assignment for fast lookup */
export function useAssignmentMap() {
  const { data: assignments } = useClientAssignments();
  const map = new Map<string, ClientAssignment>();
  if (assignments) {
    for (const a of assignments) {
      map.set(a.source_id, a);
    }
  }
  return map;
}

/** Assign a client to an agent (+ optional manager). Skips if already assigned. */
export function useAssignClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { sourceId: string; sourceType: string; agentId: string; managerId?: string }) => {
      const {
        data: { session: __s },
      } = await supabase.auth.getSession();
      const user = __s?.user ?? null;
      if (!user) throw new Error("Not authenticated");

      // Check if already assigned
      const existing = await findClientAssignment(params.sourceId, user.id);
      if (existing) return existing; // already assigned

      return insertClientAssignmentReturning({
        source_id: params.sourceId,
        source_type: params.sourceType,
        agent_id: params.agentId,
        manager_id: params.managerId || null,
        user_id: user.id,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

/** Get all clients assigned to a specific agent */
export function useAgentClients(agentId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.agents.clients(agentId),
    enabled: !!agentId,
    queryFn: async () => {
      const {
        data: { session: __s },
      } = await supabase.auth.getSession();
      const user = __s?.user ?? null;
      if (!user) return [];
      return findClientAssignmentsByAgent(agentId!, user.id);
    },
  });
}
