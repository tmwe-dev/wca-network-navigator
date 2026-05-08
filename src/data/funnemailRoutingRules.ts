/**
 * DAL — Funnemail Routing Rules (Sprint 4)
 * Regole composite editabili dall'utente per auto-routing inbound email.
 */
import { untypedFrom } from "@/lib/supabaseUntyped";

export interface FunnemailRoutingCondition {
  field: "from_address" | "domain" | "subject" | "body";
  op: "equals" | "contains" | "starts_with" | "ends_with" | "regex" | "in";
  value: string | string[];
}

export interface FunnemailRoutingRuleRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  conditions: FunnemailRoutingCondition[];
  target_group_id: string | null;
  target_group_name: string | null;
  confidence_threshold: number;
  priority: number;
  enabled: boolean;
  match_count: number;
  last_matched_at: string | null;
  created_at: string;
  updated_at: string;
}

const TABLE = "funnemail_routing_rules" as const;

export async function listFunnemailRoutingRules(): Promise<FunnemailRoutingRuleRow[]> {
  const { data, error } = await untypedFrom(TABLE)
    .select("*")
    .order("priority", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as FunnemailRoutingRuleRow[];
}

export async function upsertFunnemailRoutingRule(
  payload: Partial<FunnemailRoutingRuleRow> & { user_id: string; name: string },
): Promise<FunnemailRoutingRuleRow> {
  const { data, error } = await untypedFrom(TABLE)
    .upsert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as FunnemailRoutingRuleRow;
}

export async function deleteFunnemailRoutingRule(id: string): Promise<void> {
  const { error } = await untypedFrom(TABLE).delete().eq("id", id);
  if (error) throw error;
}

export async function toggleFunnemailRoutingRule(id: string, enabled: boolean): Promise<void> {
  const { error } = await untypedFrom(TABLE).update({ enabled }).eq("id", id);
  if (error) throw error;
}
