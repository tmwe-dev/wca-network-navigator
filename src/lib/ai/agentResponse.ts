import type { AiOperation } from "@/components/ai/AiOperationCard";
import { createLogger } from "@/lib/log";

const log = createLogger("agentResponse");

export interface JobCreatedInfo {
  job_id: string;
  country: string;
  mode: string;
  total_partners: number;
  estimated_time_minutes: number;
}

export interface AiUiAction {
  action_type: "navigate" | "show_toast" | "apply_filters" | "open_dialog" | "start_download_job";
  path?: string;
  message?: string;
  toast_type?: "default" | "success" | "error";
  filters?: Record<string, unknown>;
  dialog?: string;
  job_id?: string;
}

export interface ParsedAiAgentResponse<TPartner = unknown> {
  text: string;
  partners: TPartner[];
  jobCreated: JobCreatedInfo | null;
  uiActions: AiUiAction[];
  operations: AiOperation[];
}

const STRUCTURED_DELIMITER = "---STRUCTURED_DATA---";
const JOB_CREATED_DELIMITER = "---JOB_CREATED---";
const COMMAND_DELIMITER = "---COMMAND---";
const UI_ACTIONS_DELIMITER = "---UI_ACTIONS---";
const OPERATIONS_DELIMITER = "---OPERATIONS---";

const HIDDEN_MARKER_PATTERN = /---(?:STRUCTURED_DATA|COMMAND|JOB_CREATED|UI_ACTIONS|OPERATIONS)---/i;
const RAW_UI_ACTIONS_PATTERN = /(?:^|\n)\s*(?:\[\s*\{[\s\S]*?"action_type"\s*:\s*"(?:navigate|show_toast|apply_filters|open_dialog|start_download_job)"[\s\S]*|\{[\s\S]*?"action_type"\s*:\s*"(?:navigate|show_toast|apply_filters|open_dialog|start_download_job)"[\s\S]*)$/i;

function extractMarkerPayload(content: string, marker: string): string | null {
  const markerIndex = content.indexOf(marker);
  if (markerIndex === -1) return null;

  const remainder = content.slice(markerIndex + marker.length).trim();
  const nextMarkerIndex = remainder.search(HIDDEN_MARKER_PATTERN);
  return (nextMarkerIndex === -1 ? remainder : remainder.slice(0, nextMarkerIndex)).trim();
}

function safeJsonParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch (e) {
    log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) });
    return fallback;
  }
}

export function sanitizeVisibleAiText(content: string): string {
  if (!content) return "";

  let cleaned = String(content);
  const hiddenMarkerIndex = cleaned.search(HIDDEN_MARKER_PATTERN);
  if (hiddenMarkerIndex !== -1) {
    cleaned = cleaned.slice(0, hiddenMarkerIndex);
  }

  cleaned = cleaned
    .replace(RAW_UI_ACTIONS_PATTERN, "")
    .replace(/```(?:json|javascript|js|ts|typescript)[\s\S]*?```/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return cleaned;
}

export function parseAiAgentResponse<TPartner = unknown>(content: string): ParsedAiAgentResponse<TPartner> {
  const partnersPayload = extractMarkerPayload(content, STRUCTURED_DELIMITER);
  const jobPayload = extractMarkerPayload(content, JOB_CREATED_DELIMITER);
  const uiPayload = extractMarkerPayload(content, UI_ACTIONS_DELIMITER);
  const opsPayload = extractMarkerPayload(content, OPERATIONS_DELIMITER);
  extractMarkerPayload(content, COMMAND_DELIMITER);

  const structured = safeJsonParse<{ type?: string; data?: TPartner[] } | null>(partnersPayload, null);
  const partners = structured?.type === "partners" && Array.isArray(structured.data) ? structured.data : [];

  const jobCreated = safeJsonParse<JobCreatedInfo | null>(jobPayload, null);
  let operations = safeJsonParse<AiOperation[]>(opsPayload, []);

  // Auto-generate operation card from jobCreated if no explicit one exists
  if (jobCreated && !operations.some(o => o.job_id === jobCreated.job_id)) {
    operations.push({
      op_type: "download",
      status: "running",
      title: `Download ${jobCreated.mode}`,
      target: jobCreated.country,
      count: jobCreated.total_partners,
      eta_minutes: jobCreated.estimated_time_minutes,
      job_id: jobCreated.job_id,
      source: "WCA Directory",
    });
  }

  return {
    text: sanitizeVisibleAiText(content),
    partners,
    jobCreated,
    uiActions: safeJsonParse<AiUiAction[]>(uiPayload, []),
    operations,
  };
}

export function dispatchAiUiActions(actions: AiUiAction[]) {
  if (typeof window === "undefined") return;
  for (const action of actions) {
    window.dispatchEvent(new CustomEvent("ai-ui-action", { detail: action }));
  }
}

export function dispatchAiAgentEffects(parsed: ParsedAiAgentResponse<any>) {
  const actions = [...parsed.uiActions];

  if (parsed.jobCreated?.job_id && !actions.some((action) => action.action_type === "start_download_job" && action.job_id === parsed.jobCreated?.job_id)) {
    actions.push({
      action_type: "start_download_job",
      job_id: parsed.jobCreated.job_id,
      message: `Avvio job ${parsed.jobCreated.job_id}`,
      toast_type: "success",
    });
  }

  dispatchAiUiActions(actions);
}
