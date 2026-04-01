import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Agent {
  id: string;
  user_id: string;
  name: string;
  role: string;
  avatar_emoji: string;
  system_prompt: string;
  knowledge_base: any[];
  elevenlabs_agent_id: string | null;
  elevenlabs_voice_id: string | null;
  assigned_tools: string[];
  schedule_config: any;
  is_active: boolean;
  stats: { tasks_completed: number; emails_sent: number; calls_made: number };
  signature_html: string | null;
  signature_image_url: string | null;
  voice_call_url: string | null;
  created_at: string;
  updated_at: string;
}

const QUERY_KEY = ["agents"] as const;

export function useAgents() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("agents" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Agent[];
    },
  });

  const createAgent = useMutation({
    mutationFn: async (agent: Partial<Agent>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("agents" as any)
        .insert({ ...agent, user_id: user.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Agent;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const updateAgent = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Agent> & { id: string }) => {
      const { error } = await supabase
        .from("agents" as any)
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const deleteAgent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("agents" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  return { agents: query.data ?? [], isLoading: query.isLoading, createAgent, updateAgent, deleteAgent };
}
