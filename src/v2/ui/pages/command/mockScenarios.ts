import type { ExecutionStep } from "@/design-system/ExecutionFlow";
import type { CardGridItem } from "./canvas/CardGridCanvas";
import type { TimelineEvent, TimelineKpi } from "./canvas/TimelineCanvas";
import type { FlowNode } from "./canvas/FlowCanvas";

export interface CanvasRow {
  cells: string[];
}

export interface CanvasData {
  headers: string[];
  rows: CanvasRow[];
  title: string;
}

export interface ApprovalPayload {
  title: string;
  description: string;
  details: { label: string; value: string }[];
  governance: { role: string; permission: string; policy: string };
}

export interface ResultPayload {
  message: string;
  kpis: { label: string; value: string }[];
}

export type CanvasType = "table" | "card-grid" | "timeline" | "flow";

export interface MockScenario {
  key: string;
  canvasType: CanvasType;
  canvasData: CanvasData | null;
  cardGridData?: CardGridItem[];
  timelineData?: { events: TimelineEvent[]; kpis: TimelineKpi[] };
  flowData?: { nodes: FlowNode[]; title: string };
  approvalPayload: ApprovalPayload | null;
  executionSteps: ExecutionStep[];
  resultPayload: ResultPayload;
}

const partnerSearch: MockScenario = {
  key: "partner-search",
  canvasType: "table",
  canvasData: {
    title: "PARTNER · RICERCA",
    headers: ["Partner", "Paese", "Ultimo contatto", "Stato"],
    rows: [
      { cells: ["Schnell Logistics GmbH", "Germania", "62 giorni fa", "Inattivo"] },
      { cells: ["TransEuropa Freight", "Germania", "45 giorni fa", "In attesa"] },
      { cells: ["Bayern Cargo AG", "Germania", "78 giorni fa", "Inattivo"] },
      { cells: ["Hamburg Express Spedition", "Germania", "31 giorni fa", "In attesa"] },
      { cells: ["Rhein-Main Transport", "Germania", "55 giorni fa", "Inattivo"] },
      { cells: ["Deutsche Logistik Partner", "Germania", "90 giorni fa", "Inattivo"] },
    ],
  },
  approvalPayload: {
    title: "Vuoi lavorare su questi 6 partner?",
    description: "Ho trovato 6 partner spedizionieri in Germania con inattività superiore a 30 giorni. Posso preparare un piano di re-engagement personalizzato per ciascuno.",
    details: [
      { label: "Partner trovati", value: "6" },
      { label: "Inattività media", value: "60 giorni" },
      { label: "Settore", value: "Spedizioni" },
    ],
    governance: { role: "Commerciale", permission: "Lavora partner", policy: "max 10/batch" },
  },
  executionSteps: [
    { label: "Caricamento profili partner", status: "pending" as const },
    { label: "Analisi storico contatti", status: "pending" as const },
    { label: "Calcolo priority score", status: "pending" as const },
    { label: "Generazione piano re-engagement", status: "pending" as const },
    { label: "Registrazione in agenda", status: "pending" as const },
  ],
  resultPayload: {
    message: "Piano di re-engagement pronto per 6 partner tedeschi. Le attività sono state aggiunte all'agenda.",
    kpis: [
      { label: "Partner processati", value: "6" },
      { label: "Email pianificate", value: "12" },
      { label: "Prossimo follow-up", value: "Domani 09:00" },
    ],
  },
};

const followupBatch: MockScenario = {
  key: "followup-batch",
  canvasType: "card-grid",
  canvasData: null,
  cardGridData: [
    { name: "Marco Chen", company: "Asia Pacific Logistics Co.", lastContact: "42 giorni fa", action: "Email follow-up partnership Q2" },
    { name: "Yuki Tanaka", company: "Tokyo Freight International", lastContact: "38 giorni fa", action: "Aggiornamento servizi rotte" },
    { name: "Li Wei", company: "Shanghai Logistics Group", lastContact: "55 giorni fa", action: "Proposta nuova collaborazione" },
    { name: "Raj Patel", company: "Mumbai Express Cargo", lastContact: "61 giorni fa", action: "Follow-up post-meeting" },
    { name: "Kim Park", company: "Seoul Cargo Services", lastContact: "33 giorni fa", action: "Re-invio quotazione aggiornata" },
    { name: "Anna Wong", company: "HK Shipping Ltd.", lastContact: "47 giorni fa", action: "Presentazione nuove rotte" },
  ],
  approvalPayload: {
    title: "Invio 6 email follow-up?",
    description: "Ho preparato 6 email personalizzate di follow-up per i contatti Asia Pacific. Ogni messaggio è stato adattato sulla base della conversation history.",
    details: [
      { label: "Email in coda", value: "6" },
      { label: "Template base", value: "Follow-up Asia Q2" },
      { label: "Personalizzazione", value: "Per contatto" },
    ],
    governance: { role: "Commerciale", permission: "Send email", policy: "richiede conferma" },
  },
  executionSteps: [
    { label: "Composizione email personalizzate", status: "pending" as const },
    { label: "Deduplicazione destinatari", status: "pending" as const },
    { label: "Quality check contenuti", status: "pending" as const },
    { label: "Invio batch email", status: "pending" as const },
    { label: "Registrazione nel log attività", status: "pending" as const },
  ],
  resultPayload: {
    message: "6 email di follow-up inviate con successo ai contatti Asia Pacific.",
    kpis: [
      { label: "Email inviate", value: "6" },
      { label: "Tasso personalizzazione", value: "100%" },
      { label: "Tempo medio composizione", value: "1.3s" },
    ],
  },
};

const agentReport: MockScenario = {
  key: "agent-report",
  canvasType: "timeline",
  canvasData: null,
  timelineData: {
    kpis: [
      { label: "Azioni approvate", value: "34" },
      { label: "In attesa", value: "7" },
      { label: "Rifiutate", value: "2" },
    ],
    events: [
      { time: "09:14", agent: "Partner Scout", action: "Scan rete WCA completato — 12 nuovi partner rilevati", status: "success" },
      { time: "09:45", agent: "Outreach Runner", action: "Batch email Europa inviato — 8 messaggi", status: "success" },
      { time: "10:22", agent: "Follow-up Watcher", action: "3 risposte rilevate — analisi sentiment avviata", status: "info" },
      { time: "11:00", agent: "Outreach Runner", action: "Invio batch Asia in attesa di approvazione", status: "pending" },
      { time: "11:30", agent: "Partner Scout", action: "Anomalia: partner DX Express rimosso dalla directory", status: "warning" },
      { time: "12:15", agent: "Follow-up Watcher", action: "Reminder automatico programmato per 5 contatti", status: "success" },
      { time: "14:00", agent: "Partner Scout", action: "Deep search completato — 3 profili arricchiti", status: "success" },
      { time: "15:30", agent: "Outreach Runner", action: "Campagna Francia completata — 100% delivery", status: "success" },
    ],
  },
  approvalPayload: null,
  executionSteps: [
    { label: "Raccolta log agenti", status: "pending" as const },
    { label: "Aggregazione metriche", status: "pending" as const },
    { label: "Generazione riepilogo", status: "pending" as const },
  ],
  resultPayload: {
    message: "Ecco il riepilogo delle attività degli agenti AI per oggi.",
    kpis: [
      { label: "Azioni approvate oggi", value: "34" },
      { label: "In attesa di approvazione", value: "7" },
      { label: "Rifiutate", value: "2" },
    ],
  },
};

const campaignPreview: MockScenario = {
  key: "campaign-preview",
  canvasType: "flow",
  canvasData: null,
  flowData: {
    title: "Campagna re-engagement Francia Q2",
    nodes: [
      { label: "Trigger: partner inattivi >30gg", type: "trigger", detail: "Filtro: country_code=FR, last_interaction<30d" },
      { label: "Selezione contatti primari", type: "condition", detail: "Max 1 contatto per partner · con email" },
      { label: "Generazione email personalizzata", type: "action", detail: "Template: re-engagement-v2 · Lingua: FR" },
      { label: "Quality check AI", type: "condition", detail: "Score minimo: 0.85 · Tone: professionale" },
      { label: "Invio batch con throttling", type: "action", detail: "Max 20/ora · Retry: 2x · Tracking: attivo" },
      { label: "Completamento + logging", type: "end", detail: "Audit trail + notifica manager" },
    ],
  },
  approvalPayload: {
    title: "Lanciare campagna Francia Q2?",
    description: "Campagna di re-engagement automatica per 15 partner francesi inattivi. Il flusso include generazione AI, quality check e invio con throttling.",
    details: [
      { label: "Partner target", value: "15" },
      { label: "Canale", value: "Email" },
      { label: "Durata stimata", value: "~45 min" },
    ],
    governance: { role: "Commerciale", permission: "WRITE:CAMPAIGN", policy: "POLICY v1.0 · SOFT-SYNC" },
  },
  executionSteps: [
    { label: "Caricamento target list", status: "pending" as const },
    { label: "Generazione contenuti AI", status: "pending" as const },
    { label: "Quality check batch", status: "pending" as const },
    { label: "Invio email con throttling", status: "pending" as const },
    { label: "Logging e audit trail", status: "pending" as const },
  ],
  resultPayload: {
    message: "Campagna Francia Q2 completata. 15 email inviate, 0 bounce, audit trail registrato.",
    kpis: [
      { label: "Email inviate", value: "15" },
      { label: "Delivery rate", value: "100%" },
      { label: "Tempo totale", value: "38 min" },
    ],
  },
};

export const mockScenarios: Record<string, MockScenario> = {
  "partner-search": partnerSearch,
  "followup-batch": followupBatch,
  "agent-report": agentReport,
  "campaign-preview": campaignPreview,
};

export function matchScenario(prompt: string): MockScenario {
  const lower = prompt.toLowerCase();
  if (lower.includes("email")) {
    return followupBatch;
  }
  return partnerSearch;
}
