/**
 * useAgents — thin wrapper around DAL.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  findAgents, createAgent as dalCreateAgent, updateAgent as dalUpdateAgent,
  deleteAgent as dalDeleteAgent, invalidateAgents,
  type Agent, type AgentInsert, type AgentUpdate,
} from "@/data/agents";

export type { Agent, AgentInsert, AgentUpdate };

const QUERY_KEY = ["agents"] as const;

export function useAgents() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      return findAgents(user.id);
    },
  });

  const createAgent = useMutation({
    mutationFn: async (agent: Partial<AgentInsert>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      return dalCreateAgent({ ...agent, user_id: user.id, name: agent.name ?? "New Agent" } as AgentInsert);
    },
    onSuccess: () => invalidateAgents(qc),
  });

  const updateAgent = useMutation({
    mutationFn: async ({ id, ...updates }: AgentUpdate & { id: string }) => {
      await dalUpdateAgent(id, updates);
    },
    onSuccess: () => invalidateAgents(qc),
  });

  const deleteAgent = useMutation({
    mutationFn: async (id: string) => dalDeleteAgent(id),
    onSuccess: () => invalidateAgents(qc),
  });

  return { agents: query.data ?? [], isLoading: query.isLoading, createAgent, updateAgent, deleteAgent };
}
