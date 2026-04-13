import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type ClientAssignmentRow = Database["public"]["Tables"]["client_assignments"]["Row"];
type ClientAssignmentInsert = Database["public"]["Tables"]["client_assignments"]["Insert"];

export type ClientAssignment = ClientAssignmentRow;

const QUERY_KEY = ["client-assignments"] as const;

/** Load all assignments for the current user (single query, cached) */
export function useClientAssignments() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("client_assignments")
        .select("*")
        .eq("user_id", user.id);
      if (error) throw error;
      return data ?? [];
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
    mutationFn: async (params: {
      sourceId: string;
      sourceType: string;
      agentId: string;
      managerId?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Check if already assigned
      const { data: existing } = await supabase
        .from("client_assignments")
        .select("id")
        .eq("source_id", params.sourceId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) return existing; // already assigned

      const { data, error } = await supabase
        .from("client_assignments")
        .insert({
          source_id: params.sourceId,
          source_type: params.sourceType,
          agent_id: params.agentId,
          manager_id: params.managerId || null,
          user_id: user.id,
        } satisfies ClientAssignmentInsert)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

/** Get all clients assigned to a specific agent */
export function useAgentClients(agentId: string | undefined) {
  return useQuery({
    queryKey: ["agent-clients", agentId],
    enabled: !!agentId,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("client_assignments")
        .select("*")
        .eq("agent_id", agentId!)
        .eq("user_id", user.id);
      if (error) throw error;
      return data ?? [];
    },
  });
}
