/**
 * DAL — agent_personas (forma completa usata da useAgentPersona).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AgentPersonaFullRow = Database["public"]["Tables"]["agent_personas"]["Row"];
type AgentPersonaFullUpsert = Database["public"]["Tables"]["agent_personas"]["Insert"];

export async function getAgentPersonaFull(agentId: string): Promise<AgentPersonaFullRow | null> {
  const { data, error } = await supabase
    .from("agent_personas")
    .select("*")
    .eq("agent_id", agentId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function upsertAgentPersonaFull(payload: AgentPersonaFullUpsert): Promise<void> {
  const { error } = await supabase
    .from("agent_personas")
    .upsert(payload, { onConflict: "agent_id" });
  if (error) throw error;
}
