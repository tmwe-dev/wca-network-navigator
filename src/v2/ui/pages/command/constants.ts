/**
 * Command Page — Types + UI metadata only.
 * All mock scenarios and demo data have been removed: the agent now drives
 * the page conversationally via ai-assistant + planExecution + tool registry.
 */

/* ─── Types ─── */
export interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  agentName?: string;
  thinking?: boolean;
  meta?: string;
  tools?: string[];
  governance?: string;
  /** Optional follow-up actions rendered as clickable buttons under the message */
  suggestedActions?: { label: string; prompt: string }[];
  /** Short conversational version used for TTS playback (max ~200 chars). */
  spokenSummary?: string;
  /** Audit trail visibile sotto il messaggio: fase, plan, tool driver, riferimenti tracciabili. */
  audit?: MessageAudit;
}

/** Audit log strutturato di una risposta del Direttore. */
export interface MessageAudit {
  /** Fase eseguita: fast-lane (single tool) o plan-execution (multi-step). */
  phase: "fast-lane" | "plan-execution" | "approval-step";
  /** Sintesi del piano in linguaggio naturale (vuoto in fast-lane). */
  planSummary?: string;
  /** Step eseguiti, in ordine. */
  steps: AuditStep[];
  /** Driver/orchestratore principale (es. "ai-query", "compose-email"). */
  driver: string;
  /** Riferimenti tracciabili: prompt operativi applicati, KB sections, model. */
  references?: AuditReference[];
  /** Durata totale (ms). */
  totalMs?: number;
}

export interface AuditStep {
  /** Numero step (1-based). 0 per fast-lane. */
  number: number;
  /** Tool ID (es. "ai-query", "compose-email"). */
  toolId: string;
  /** Etichetta human-readable. */
  label: string;
  /** Reasoning del planner per questo step (se disponibile). */
  reasoning?: string;
  /** Durata (ms). */
  durationMs?: number;
  /** Stato finale. */
  status: "ok" | "failed" | "approved" | "skipped";
}

export interface AuditReference {
  /** Tipo riferimento. */
  kind: "operative-prompt" | "kb-section" | "model" | "playbook" | "context" | "table" | "column" | "keyword";
  /** Etichetta del riferimento. */
  label: string;
  /** Valore o id (es. nome prompt, sezione KB, model name). */
  value?: string;
}

export type CanvasType =
  | "live-table"
  | "live-card-grid"
  | "live-timeline"
  | "live-flow"
  | "live-composer"
  | "live-approval"
  | "live-report"
  | "live-result"
  | "live-multi"
  | null;

export type FlowPhase = "idle" | "thinking" | "proposal" | "approval" | "executing" | "done";
export type ToolPhase = "activating" | "active" | "done";

export interface GovernanceInfo {
  role: string;
  permission: string;
  policy: string;
}

/* ─── UI Static Metadata ─── */

export const agentDots = [
  { agent: "Orchestratore", status: "done" },
  { agent: "CRM Core", status: "done" },
  { agent: "Partner Scout", status: "done" },
  { agent: "Outreach Runner", status: "running" },
  { agent: "Follow-up Watcher", status: "monitoring" },
  { agent: "Automation", status: "done" },
  { agent: "Governance", status: "monitoring" },
];

export const quickPrompts = [
  "Mostrami i partner italiani senza email",
  "Quante attività aperte ho oggi?",
  "Cerca contatti inattivi da più di 30 giorni",
  "Stato della coda outreach",
  "Riepilogo agenti nelle ultime 24h",
  "Snapshot dashboard generale",
  "Partner top per rating in Germania",
  "Verifica blacklist per <nome azienda>",
];

export const capabilities = [
  "Ricerca Partner & Contatti",
  "Composizione Email",
  "Gestione Campagne",
  "Analisi Pipeline",
  "Knowledge Base",
  "Audit & Governance",
];
