/**
 * DAL — query di osservabilità (usage budget e log azioni agente).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type UsageDailyBudgetRow = Database["public"]["Tables"]["usage_daily_budget"]["Row"];
type AgentActionLogRow = Database["public"]["Tables"]["agent_action_log"]["Row"];

export type UsageDailyBudgetSlice = Pick<
  UsageDailyBudgetRow,
  "ai_tokens_used" | "tts_chars_used" | "ai_token_cap" | "tts_char_cap" | "usage_date"
>;
export type AgentActionToolName = Pick<AgentActionLogRow, "tool_name">;
export type AgentActionMissionRow = Pick<AgentActionLogRow, "conversation_id" | "result">;

/** Ultimi 30 giorni di consumo per utente. */
export async function findUsageDailyBudgetRows(userId: string): Promise<UsageDailyBudgetSlice[]> {
  const { data, error } = await supabase
    .from("usage_daily_budget")
    .select("ai_tokens_used, tts_chars_used, ai_token_cap, tts_char_cap, usage_date")
    .eq("user_id", userId)
    .order("usage_date", { ascending: false })
    .limit(30);
  if (error) throw error;
  return data ?? [];
}

/** Nomi tool usati di recente dall'utente. */
export async function findAgentActionToolNames(userId: string): Promise<AgentActionToolName[]> {
  const { data, error } = await supabase
    .from("agent_action_log")
    .select("tool_name")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return data ?? [];
}

/** Righe log per calcolo missioni/step/errori. */
export async function findAgentActionMissionRows(userId: string): Promise<AgentActionMissionRow[]> {
  const { data, error } = await supabase
    .from("agent_action_log")
    .select("conversation_id, result")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return data ?? [];
}
