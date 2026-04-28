/**
 * DAL — agent-audit edge function client.
 *
 * Read-only audit comparing what is controlled by the Prompt Lab (DB)
 * versus what is hardcoded in code, per agent and per tool.
 */
import { supabase } from "@/integrations/supabase/client";

export interface AgentAuditCapabilityDiffRow {
  field: string;
  hardcoded_default: unknown;
  db_value: unknown;
  overridden: boolean;
  controlled_by: "db" | "code";
}

export interface AgentAuditToolRow {
  name: string;
  in_registry: boolean;
  in_allowed_list: boolean;
  in_blocked_list: boolean;
  effective: boolean;
  approval_hardcoded: boolean;
  approval_added_by_db: boolean;
  controlled_by: "code" | "db" | "code+db";
}

export interface AgentAuditEntry {
  agent: { id: string; name: string; role: string; avatar: string | null };
  persona: {
    source: string;
    db_loaded: boolean;
    editable_in_prompt_lab: boolean;
    db_value: Record<string, unknown> | null;
    hardcoded_fallback: string | null;
  };
  capabilities: {
    source: string;
    db_loaded: boolean;
    editable_in_prompt_lab: boolean;
    diff: AgentAuditCapabilityDiffRow[];
  };
  operative_prompts: {
    source: string;
    editable_in_prompt_lab: boolean;
    loaded_count: number;
    applied: string[];
    has_mandatory: boolean;
    hardcoded_fallback: string | null;
  };
  tools: {
    registry_source: string;
    registry_editable: boolean;
    db_filter_editable: boolean;
    execution_mode: string;
    effective_count: number;
    total_count: number;
    rows: AgentAuditToolRow[];
  };
  system_prompt: {
    sections: ReadonlyArray<{ id: string; source: string; note: string }>;
  };
}

export interface AgentAuditResponse {
  generated_at: string;
  hard_guards: {
    source: string;
    editable: boolean;
    note: string;
    forbidden_tables: string[];
    destructive_blocked: string[];
    approval_always_required: string[];
    bulk_caps: { default: number; hard_max: number };
  };
  agents: AgentAuditEntry[];
}

export async function fetchAgentAudit(): Promise<AgentAuditResponse> {
  const { data, error } = await supabase.functions.invoke<AgentAuditResponse>("agent-audit", {
    method: "GET",
  });
  if (error) throw error;
  if (!data) throw new Error("agent-audit: empty response");
  return data;
}