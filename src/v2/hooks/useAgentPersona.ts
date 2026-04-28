/**
 * useAgentPersona — CRUD hook for agent_personas table
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { toast } from "sonner";

export interface AgentPersona {
  id: string;
  agent_id: string;
  user_id: string;
  tone: string;
  language: string;
  style_rules: string[];
  vocabulary_do: string[];
  vocabulary_dont: string[];
  example_messages: Array<{ role: string; content: string }>;
  signature_template: string | null;
  kb_filter: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export function useAgentPersona(agentId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["agent-persona", agentId],
    queryFn: async (): Promise<AgentPersona | null> => {
      if (!agentId) return null;
      const { data, error } = await supabase
        .from("agent_personas" as never)
        .select("*")
        .eq("agent_id", agentId)
        .maybeSingle();
      if (error) throw error;
      return data as AgentPersona | null;
    },
    enabled: !!agentId,
  });

  const upsert = useMutation({
    mutationFn: async (persona: Partial<AgentPersona> & { agent_id: string }) => {
      const { data: { session: __s } } = await supabase.auth.getSession(); const user = __s?.user ?? null;
      if (!user) throw new Error("Non autenticato");

      const payload = {
        ...persona,
        user_id: user.id,
      };

      const { error } = await supabase
        .from("agent_personas" as never)
        .upsert(payload as never, { onConflict: "agent_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-persona", agentId] });
      toast.success("Persona salvata");
    },
    onError: (err: Error) => {
      toast.error(`Errore: ${err.message}`);
    },
  });

  return { persona: query.data, isLoading: query.isLoading, upsert };
}
