/**
 * DAL — ai_prompt_log: consumo giornaliero per il pannello di controllo costi.
 */
import { supabase } from "@/integrations/supabase/client";

export interface PromptLogUsageRow {
  function_name: string | null;
  cost_usd: number | null;
}

/** Righe di log (function_name, cost_usd) da una data in poi. */
export async function findPromptLogUsageSince(sinceIso: string, limit = 5000): Promise<PromptLogUsageRow[]> {
  const { data, error } = await supabase
    .from("ai_prompt_log")
    .select("function_name, cost_usd")
    .gte("created_at", sinceIso)
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
