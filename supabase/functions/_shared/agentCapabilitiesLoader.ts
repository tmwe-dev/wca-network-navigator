/**
 * _shared/agentCapabilitiesLoader.ts — DB-backed agent capabilities.
 *
 * Source of truth for per-agent runtime governance:
 *   - tool whitelist / blacklist
 *   - extra approval-required tools (in addition to hard guards)
 *   - concurrency, step timeout, loop iterations
 *   - max tokens, temperature, preferred model
 *   - execution mode (autonomous | supervised | read_only)
 *
 * NEVER bypasses hardGuards (forbidden tables, destructive actions, bulk caps).
 * On any error returns sane DEFAULTS so the agent loop is never blocked.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// deno-lint-ignore no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any>>;

export type AgentExecutionMode = "autonomous" | "supervised" | "read_only";

export interface AgentCapabilities {
  agentId: string | null;
  allowedTools: string[];           // empty => all registry tools allowed
  blockedTools: string[];
  approvalRequiredTools: string[];
  maxConcurrentTools: number;
  stepTimeoutMs: number;
  maxIterations: number;
  maxTokensPerCall: number;
  temperature: number;
  preferredModel: string | null;
  executionMode: AgentExecutionMode;
  /** True when capabilities row was actually loaded from DB. */
  loaded: boolean;
}

export const DEFAULT_CAPABILITIES: AgentCapabilities = {
  agentId: null,
  allowedTools: [],
  blockedTools: [],
  approvalRequiredTools: [],
  maxConcurrentTools: 3,
  stepTimeoutMs: 25000,
  maxIterations: 12,
  maxTokensPerCall: 1500,
  temperature: 0.2,
  preferredModel: null,
  executionMode: "supervised",
  loaded: false,
};

/**
 * Read-only tool list — used when execution_mode === "read_only".
 * Anything not in this set is silently filtered out from the available tools.
 */
export const READ_ONLY_TOOL_SET: ReadonlySet<string> = new Set([
  "navigate", "read_page", "read_dom", "read_table",
  "list_kb", "read_kb", "scrape_url",
  "ask_user", "finish",
  "wait_for", "scroll_to", "take_snapshot",
]);

export async function loadAgentCapabilities(
  supabase: SupabaseClient,
  agentId: string | null | undefined,
): Promise<AgentCapabilities> {
  if (!agentId) return { ...DEFAULT_CAPABILITIES };
  try {
    const { data, error } = await supabase
      .from("agent_capabilities")
      .select(
        "agent_id, allowed_tools, blocked_tools, approval_required_tools, " +
        "max_concurrent_tools, step_timeout_ms, max_iterations, " +
        "max_tokens_per_call, temperature, preferred_model, execution_mode",
      )
      .eq("agent_id", agentId)
      .maybeSingle();
    if (error || !data) return { ...DEFAULT_CAPABILITIES, agentId };
    const row = data as Record<string, unknown>;
    return {
      agentId,
      allowedTools: (row.allowed_tools as string[]) ?? [],
      blockedTools: (row.blocked_tools as string[]) ?? [],
      approvalRequiredTools: (row.approval_required_tools as string[]) ?? [],
      maxConcurrentTools: Number(row.max_concurrent_tools ?? DEFAULT_CAPABILITIES.maxConcurrentTools),
      stepTimeoutMs: Number(row.step_timeout_ms ?? DEFAULT_CAPABILITIES.stepTimeoutMs),
      maxIterations: Number(row.max_iterations ?? DEFAULT_CAPABILITIES.maxIterations),
      maxTokensPerCall: Number(row.max_tokens_per_call ?? DEFAULT_CAPABILITIES.maxTokensPerCall),
      temperature: Number(row.temperature ?? DEFAULT_CAPABILITIES.temperature),
      preferredModel: (row.preferred_model as string | null) ?? null,
      executionMode: ((row.execution_mode as AgentExecutionMode) ?? "supervised"),
      loaded: true,
    };
  } catch (e) {
    console.warn("[agentCapabilitiesLoader] fallback to defaults:", (e as Error).message);
    return { ...DEFAULT_CAPABILITIES, agentId: agentId ?? null };
  }
}

/**
 * Filter a tool registry against capabilities.
 * - blocked_tools wins over allowed_tools
 * - allowed_tools empty => allow all (minus blocked)
 * - read_only mode => intersect with READ_ONLY_TOOL_SET
 */
export function filterToolsByCapabilities<T extends { name?: string; function?: { name?: string } }>(
  tools: readonly T[],
  caps: AgentCapabilities,
): T[] {
  const allow = new Set(caps.allowedTools);
  const block = new Set(caps.blockedTools);
  return tools.filter((t) => {
    const name = (t as { name?: string }).name
      ?? (t as { function?: { name?: string } }).function?.name
      ?? "";
    if (!name) return false;
    if (block.has(name)) return false;
    if (allow.size > 0 && !allow.has(name)) return false;
    if (caps.executionMode === "read_only" && !READ_ONLY_TOOL_SET.has(name)) return false;
    return true;
  });
}

/**
 * True when a tool needs explicit user approval according to capabilities.
 * Hard guards still apply on top of this (never weaker).
 */
export function toolRequiresApproval(toolName: string, caps: AgentCapabilities): boolean {
  if (caps.executionMode === "supervised") {
    // Supervised mode: any tool with side-effect listed in approval_required_tools
    return caps.approvalRequiredTools.includes(toolName);
  }
  if (caps.executionMode === "read_only") {
    // Read-only: writes are not allowed at all (filtered), but be safe.
    return !READ_ONLY_TOOL_SET.has(toolName);
  }
  // Autonomous: only explicitly listed
  return caps.approvalRequiredTools.includes(toolName);
}