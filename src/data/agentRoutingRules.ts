/**
 * DAL — agent_routing_rules.
 *
 * Persona-aware routing rules editable from the Prompt Lab.
 * agent_id null = global (applies to all personas as fallback).
 */
import { supabase } from "@/integrations/supabase/client";

export type RoutingPriority = "low" | "normal" | "high" | "critical";

export interface AgentRoutingRule {
  id: string;
  user_id: string;
  agent_id: string | null;
  name: string;
  description: string | null;
  enabled: boolean;
  priority: number;
  match_domain: string | null;
  match_category: string | null;
  match_sentiment: string | null;
  match_lead_status: string | null;
  match_min_confidence: number;
  match_keywords: string[];
  bias_domain_hint: string | null;
  bias_category_hint: string | null;
  bias_tone_hint: string | null;
  bias_extra_instructions: string | null;
  override_next_status: string | null;
  override_action_type: string | null;
  override_priority: string | null;
  override_confidence_floor: number | null;
  override_skip_action: boolean;
  match_count: number;
  last_matched_at: string | null;
  created_at: string;
  updated_at: string;
}

const COLS =
  "id, user_id, agent_id, name, description, enabled, priority, " +
  "match_domain, match_category, match_sentiment, match_lead_status, " +
  "match_min_confidence, match_keywords, " +
  "bias_domain_hint, bias_category_hint, bias_tone_hint, bias_extra_instructions, " +
  "override_next_status, override_action_type, override_priority, " +
  "override_confidence_floor, override_skip_action, " +
  "match_count, last_matched_at, created_at, updated_at";

export async function listAgentRoutingRules(): Promise<AgentRoutingRule[]> {
  const { data, error } = await supabase
    .from("agent_routing_rules")
    .select(COLS)
    .order("priority", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as AgentRoutingRule[];
}

export async function createAgentRoutingRule(
  input: Omit<
    AgentRoutingRule,
    "id" | "user_id" | "match_count" | "last_matched_at" | "created_at" | "updated_at"
  > & { user_id: string },
): Promise<AgentRoutingRule> {
  const { data, error } = await supabase
    .from("agent_routing_rules")
    .insert(input as never)
    .select(COLS)
    .single();
  if (error) throw error;
  return data as unknown as AgentRoutingRule;
}

export async function updateAgentRoutingRule(
  id: string,
  patch: Partial<Omit<AgentRoutingRule, "id" | "user_id" | "created_at" | "updated_at">>,
): Promise<void> {
  const { error } = await supabase
    .from("agent_routing_rules")
    .update(patch as never)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteAgentRoutingRule(id: string): Promise<void> {
  const { error } = await supabase
    .from("agent_routing_rules")
    .delete()
    .eq("id", id);
  if (error) throw error;
}