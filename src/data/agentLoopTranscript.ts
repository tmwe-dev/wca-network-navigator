/**
 * DAL — persistenza transcript dell'agent loop legacy (`command_messages` +
 * `agent_action_log`). Estratto dai bypass DAL diretti di `useAgentLoop`:
 * stesso payload, stessa semantica (errori ignorati dal chiamante).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type CommandMessageInsert = Database["public"]["Tables"]["command_messages"]["Insert"];
type AgentActionLogInsert = Database["public"]["Tables"]["agent_action_log"]["Insert"];

export async function insertCommandMessage(message: CommandMessageInsert): Promise<void> {
  const { error } = await supabase.from("command_messages").insert(message);
  if (error) throw error;
}

export async function insertAgentActionLogEntries(entries: AgentActionLogInsert[]): Promise<void> {
  if (entries.length === 0) return;
  const { error } = await supabase.from("agent_action_log").insert(entries);
  if (error) throw error;
}
