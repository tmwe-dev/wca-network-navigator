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
  /** Optional short text used by TTS instead of visible content */
  spokenSummary?: string;
  /** Prevents TTS for restored/history/status messages */
  silent?: boolean;
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
