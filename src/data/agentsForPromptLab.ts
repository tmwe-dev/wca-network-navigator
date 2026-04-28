/**
 * DAL — minimal agents listing for Prompt Lab capabilities tab.
 */
import { supabase } from "@/integrations/supabase/client";

export interface AgentMini {
  id: string;
  name: string;
  role: string;
  avatar_emoji: string;
}

export async function listAgentsForCapabilities(): Promise<AgentMini[]> {
  const { data, error } = await supabase
    .from("agents")
    .select("id, name, role, avatar_emoji")
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AgentMini[];
}