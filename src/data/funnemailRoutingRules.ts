/**
 * DAL — Funnemail Routing Rules (Sprint 4)
 * Regole composite editabili dall'utente per auto-routing inbound email.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

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

function isCondition(item: unknown): item is FunnemailRoutingCondition {
  if (typeof item !== "object" || item === null || Array.isArray(item)) return false;
  const rec = item as Record<string, unknown>;
  return typeof rec.field === "string" && typeof rec.op === "string" && "value" in rec;
}

/** Narrowing runtime esplicito: converte il Json della colonna `conditions`. */
function toConditions(json: Json): FunnemailRoutingCondition[] {
  if (!Array.isArray(json)) return [];
  const out: FunnemailRoutingCondition[] = [];
  for (const item of json) {
    if (isCondition(item)) out.push(item);
  }
  return out;
}

function mapRow(row: {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  conditions: Json;
  target_group_id: string | null;
  target_group_name: string | null;
  confidence_threshold: number;
  priority: number;
  enabled: boolean;
  match_count: number;
  last_matched_at: string | null;
  created_at: string;
  updated_at: string;
}): FunnemailRoutingRuleRow {
  return { ...row, conditions: toConditions(row.conditions) };
}

export async function listFunnemailRoutingRules(): Promise<FunnemailRoutingRuleRow[]> {
  const { data, error } = await supabase.from(TABLE)
    .select("*")
    .order("priority", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function upsertFunnemailRoutingRule(
  payload: Partial<FunnemailRoutingRuleRow> & { user_id: string; name: string },
): Promise<FunnemailRoutingRuleRow> {
  const { conditions, ...rest } = payload;
  // Serializzazione JSON-safe esplicita (niente cast alla cieca): le
  // condizioni sono già plain object literals (field/op/value string|string[]).
  const conditionsJson = conditions
    ? (JSON.parse(JSON.stringify(conditions)) as Json[])
    : undefined;
  const { data, error } = await supabase.from(TABLE)
    .upsert({
      ...rest,
      ...(conditionsJson ? { conditions: conditionsJson } : {}),
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapRow(data);
}

export async function deleteFunnemailRoutingRule(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw error;
}

export async function toggleFunnemailRoutingRule(id: string, enabled: boolean): Promise<void> {
  const { error } = await supabase.from(TABLE).update({ enabled }).eq("id", id);
  if (error) throw error;
}
