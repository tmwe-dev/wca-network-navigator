/**
 * Sherlock — tipi condivisi (playbook, step, investigazione, findings).
 */

export type SherlockLevel = 1 | 2 | 3;
export type SherlockChannel = "generic" | "linkedin" | "whatsapp";

export interface SherlockStep {
  order: number;
  label: string;
  url_template: string;
  required_vars: string[];
  settle_ms?: number;
  channel?: SherlockChannel;
  ai_extract_prompt: string;
  ai_decide_next?: boolean;
  depends_on?: number[];
}

export interface SherlockPlaybook {
  id: string;
  level: SherlockLevel;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  steps: SherlockStep[];
  target_fields: string[];
  estimated_seconds: number;
  created_at: string;
  updated_at: string;
}

export type StepStatus = "pending" | "running" | "done" | "error" | "skipped" | "cached";

export interface SherlockStepResult {
  order: number;
  label: string;
  url: string | null;
  channel: SherlockChannel;
  status: StepStatus;
  markdown: string;
  findings: Record<string, unknown>;
  confidence: number | null;
  suggested_next_url: string | null;
  error?: string;
  started_at: number;
  duration_ms?: number;
  ai_duration_ms?: number;
  cache_hit?: boolean;
}

export interface SherlockInvestigation {
  id: string;
  user_id: string;
  operator_id: string | null;
  playbook_id: string | null;
  level: SherlockLevel;
  partner_id: string | null;
  contact_id: string | null;
  target_label: string | null;
  status: "running" | "completed" | "aborted" | "failed";
  vars: Record<string, string>;
  findings: Record<string, unknown>;
  step_log: SherlockStepResult[];
  summary: string | null;
  duration_ms: number | null;
  started_at: string;
  completed_at: string | null;
}

export interface SherlockProgressEvent {
  step: SherlockStep;
  result: SherlockStepResult;
  totalSteps: number;
  currentIndex: number;
  consolidated: Record<string, unknown>;
}
