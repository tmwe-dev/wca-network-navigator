import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

/** Row type derived from the generated Supabase schema */
export type Agent = Database["public"]["Tables"]["agents"]["Row"] & {
  /** Typed overlay for the JSON stats column */
  stats: { tasks_completed: number; emails_sent: number; calls_made: number };
  assigned_tools: string[];
  knowledge_base: Record<string, unknown>[];
};

type AgentInsert = Database["public"]["Tables"]["agents"]["Insert"];
type AgentUpdate = Database["public"]["Tables"]["agents"]["Update"];

const QUERY_KEY = ["agents"] as const;

export function useAgents() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("agents")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Agent[];
    },
  });

  const createAgent = useMutation({
    mutationFn: async (agent: Partial<AgentInsert>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("agents")
        .insert({ ...agent, user_id: user.id, name: agent.name ?? "New Agent" } satisfies AgentInsert)
        .select()
        .single();
      if (error) throw error;
      return data as Agent;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const updateAgent = useMutation({
    mutationFn: async ({ id, ...updates }: AgentUpdate & { id: string }) => {
      const { error } = await supabase
        .from("agents")
        .update({ ...updates, updated_at: new Date().toISOString() } satisfies AgentUpdate)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const deleteAgent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("agents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  return { agents: query.data ?? [], isLoading: query.isLoading, createAgent, updateAgent, deleteAgent };
}
