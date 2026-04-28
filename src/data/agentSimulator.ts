/**
 * DAL — agent-simulate edge function client.
 */
import { supabase } from "@/integrations/supabase/client";

export interface SimulatorRequest {
  agentId: string | null;
  userMessage: string;
  sessionContext?: Record<string, unknown> | null;
  dryRunAI?: boolean;
}

export interface SimulatorResponse {
  assembled: { system_prompt: string; char_count: number };
  persona: {
    loaded: boolean;
    tone?: string;
    language?: string;
    block_preview?: string;
    note?: string;
  };
  capabilities: {
    loaded: boolean;
    execution_mode: string;
    preferred_model: string | null;
    temperature: number;
    max_tokens_per_call: number;
    max_iterations: number;
    max_concurrent_tools: number;
    step_timeout_ms: number;
  };
  operative_prompts: {
    applied: string[];
    has_mandatory: boolean;
    matched: { contexts: string[]; tags: string[] };
    block_preview: string;
  };
  tools: {
    all_registered: string[];
    effective: string[];
    filtered_out: string[];
    approval_map: Array<{ name: string; requires_approval: boolean }>;
  };
  hard_guards: {
    forbidden_tables: string[];
    destructive_ops_blocked: string[];
    bulk_caps: Record<string, number>;
    approval_required_always: string[];
    notes: string;
  };
  dry_run: {
    model?: string;
    elapsed_ms?: number;
    message?: string;
    proposed_tool_calls?: Array<{
      name: string;
      arguments: unknown;
      would_be_blocked: boolean;
      would_require_approval: boolean;
    }>;
    usage?: Record<string, unknown> | null;
    error?: string;
    detail?: string;
  } | null;
}

export async function runAgentSimulator(req: SimulatorRequest): Promise<SimulatorResponse> {
  const { data, error } = await supabase.functions.invoke("agent-simulate", { body: req });
  if (error) throw error;
  return data as SimulatorResponse;
}