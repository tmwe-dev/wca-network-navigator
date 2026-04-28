/**
 * agentRoutingRules.ts — DB-backed persona-aware routing.
 *
 * Loads `agent_routing_rules` and applies them in two phases:
 *   1) renderRoutingBiasBlock(): pre-classification — adds soft hints
 *      (domain/category/tone/extra instructions) into the AI prompt.
 *   2) applyRoutingOverrides(): post-classification — given the AI output,
 *      finds the matching rule (by agent + domain + category + sentiment +
 *      lead_status + min_confidence + keywords) and returns hard overrides:
 *      next_status, action_type, priority, confidence_floor, skip_action.
 *
 * Rules are evaluated in priority order (lower number = higher priority).
 * Persona-specific rules (agent_id NOT NULL) win over global ones.
 * The first matching rule per phase is applied.
 * Soft-fail: any DB error returns no rules (zero behavior change).
 */
import type { SupabaseClient as BaseSupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// deno-lint-ignore no-explicit-any
type SupabaseClient = BaseSupabaseClient<any, "public", any>;

export interface RoutingRule {
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
}

export interface ClassificationLike {
  domain: string;
  category: string;
  confidence: number;
  sentiment?: string;
  keywords?: string[];
}

export interface RoutingMatchContext {
  agentId?: string | null;
  leadStatus?: string | null;
}

export interface AppliedOverride {
  rule: { id: string; name: string };
  nextStatus?: string;
  actionType?: string;
  priority?: string;
  confidenceFloor?: number;
  skipAction?: boolean;
}

/**
 * Load enabled rules for the user. Returns persona-specific (agentId match)
 * AND global (agent_id IS NULL) rules ordered by priority asc.
 * Soft-fails to [].
 */
export async function loadRoutingRules(
  supabase: SupabaseClient,
  userId: string,
  agentId?: string | null,
): Promise<RoutingRule[]> {
  if (!userId) return [];
  try {
    let q = supabase
      .from("agent_routing_rules")
      .select("*")
      .eq("enabled", true)
      .order("priority", { ascending: true });
    if (agentId) {
      // persona-specific OR global
      q = q.or(`agent_id.eq.${agentId},agent_id.is.null`);
    } else {
      q = q.is("agent_id", null);
    }
    const { data, error } = await q;
    if (error) {
      console.warn("[agentRoutingRules] query error:", error.message);
      return [];
    }
    return (data ?? []) as RoutingRule[];
  } catch (e) {
    console.warn("[agentRoutingRules] load failed:", (e as Error).message);
    return [];
  }
}

/**
 * Pre-classification block: turns rules into soft hints for the AI prompt.
 * Aggregates UP TO 3 most relevant rules (highest priority) so the prompt
 * stays compact. Returns "" when no bias is configured.
 */
export function renderRoutingBiasBlock(
  rules: RoutingRule[],
  ctx: RoutingMatchContext,
): string {
  // Pre-class we don't yet know the AI's output, so we surface ALL rules
  // whose match_lead_status is either null or matches current lead state.
  const candidates = rules.filter((r) => {
    if (r.match_lead_status && ctx.leadStatus && r.match_lead_status !== ctx.leadStatus) return false;
    const hasBias = r.bias_domain_hint || r.bias_category_hint || r.bias_tone_hint || r.bias_extra_instructions;
    return !!hasBias;
  }).slice(0, 3);

  if (candidates.length === 0) return "";

  const lines: string[] = ["## REGOLE DI ROUTING PERSONA-AWARE (suggerimenti)"];
  for (const r of candidates) {
    const tag = r.agent_id ? "persona" : "globale";
    lines.push(`- [${tag}] ${r.name}`);
    if (r.bias_domain_hint) lines.push(`    dominio preferito: ${r.bias_domain_hint}`);
    if (r.bias_category_hint) lines.push(`    categoria preferita: ${r.bias_category_hint}`);
    if (r.bias_tone_hint) lines.push(`    tono atteso: ${r.bias_tone_hint}`);
    if (r.bias_extra_instructions) lines.push(`    nota: ${r.bias_extra_instructions}`);
  }
  lines.push("Usa questi segnali come bias, NON come obbligo. Decidi tu se sono coerenti con l'email.");
  return lines.join("\n");
}

/**
 * Post-classification: returns the FIRST rule matching the AI output.
 * Persona-specific rules are preferred over globals (already by query order +
 * the secondary sort below).
 */
export function findMatchingRule(
  rules: RoutingRule[],
  classification: ClassificationLike,
  ctx: RoutingMatchContext,
): RoutingRule | null {
  const sorted = [...rules].sort((a, b) => {
    // persona-specific first, then by priority asc
    const aw = a.agent_id ? 0 : 1;
    const bw = b.agent_id ? 0 : 1;
    if (aw !== bw) return aw - bw;
    return a.priority - b.priority;
  });

  const sentiment = classification.sentiment ?? "";
  const keywords = (classification.keywords ?? []).map((k) => k.toLowerCase());

  for (const r of sorted) {
    if (r.match_domain && r.match_domain !== classification.domain) continue;
    if (r.match_category && r.match_category !== classification.category) continue;
    if (r.match_sentiment && r.match_sentiment !== sentiment) continue;
    if (r.match_lead_status && r.match_lead_status !== (ctx.leadStatus ?? "")) continue;
    if (classification.confidence < r.match_min_confidence) continue;
    if (r.match_keywords.length > 0) {
      const lower = r.match_keywords.map((k) => k.toLowerCase());
      const anyHit = lower.some((kw) => keywords.includes(kw));
      if (!anyHit) continue;
    }
    return r;
  }
  return null;
}

/**
 * Convert a matched rule into an applied-override descriptor.
 * Caller is responsible for performing the actual mutations.
 */
export function buildOverride(rule: RoutingRule): AppliedOverride {
  return {
    rule: { id: rule.id, name: rule.name },
    nextStatus: rule.override_next_status ?? undefined,
    actionType: rule.override_action_type ?? undefined,
    priority: rule.override_priority ?? undefined,
    confidenceFloor: rule.override_confidence_floor ?? undefined,
    skipAction: rule.override_skip_action || undefined,
  };
}

/**
 * Increment the match counter (best-effort, non-blocking).
 */
export async function recordRuleMatch(
  supabase: SupabaseClient,
  ruleId: string,
): Promise<void> {
  try {
    await supabase.rpc("increment_routing_rule_match", { _rule_id: ruleId });
  } catch (e) {
    console.warn("[agentRoutingRules] record match failed:", (e as Error).message);
  }
}