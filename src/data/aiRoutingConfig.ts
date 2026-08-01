/**
 * DAL — ai_routing_config
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AiRoutingConfigUpdate = Database["public"]["Tables"]["ai_routing_config"]["Update"];

export interface AiRoutingConfigRow {
  scope: string;
  provider: string;
  model: string;
  tier: string | null;
  notes: string | null;
  updated_at: string | null;
}

export async function findAiRoutingConfigs(): Promise<AiRoutingConfigRow[]> {
  const { data, error } = await supabase
    .from("ai_routing_config")
    .select("scope, provider, model, tier, notes, updated_at")
    .order("tier", { ascending: true })
    .order("scope", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function updateAiRoutingConfig(scope: string, patch: AiRoutingConfigUpdate): Promise<void> {
  const { error } = await supabase.from("ai_routing_config").update(patch).eq("scope", scope);
  if (error) throw error;
}
