import type { ExecutionStep } from "@/design-system/ExecutionFlow";

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

export interface MockScenario {
  key: string;
  canvasData: CanvasData | null;
  approvalPayload: ApprovalPayload | null;
  executionSteps: ExecutionStep[];
  resultPayload: ResultPayload;
}

const partnerSearch: MockScenario = {
  key: "partner-search",
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
    description:
      "Ho trovato 6 partner spedizionieri in Germania con inattività superiore a 30 giorni. Posso preparare un piano di re-engagement personalizzato per ciascuno.",
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
  canvasData: {
    title: "EMAIL · CODA FOLLOW-UP",
    headers: ["Destinatario", "Oggetto", "Stato"],
    rows: [
      { cells: ["marco.chen@asiapacific.co", "Re: Partnership Q2", "Bozza pronta"] },
      { cells: ["yuki.tanaka@tokyofreight.jp", "Aggiornamento servizi", "Bozza pronta"] },
      { cells: ["li.wei@shanghailog.cn", "Proposta collaborazione", "Bozza pronta"] },
      { cells: ["raj.patel@mumbaiexpress.in", "Follow-up meeting", "Bozza pronta"] },
      { cells: ["kim.park@seoulcargo.kr", "Re: Quotazione", "Bozza pronta"] },
      { cells: ["anna.wong@hkshipping.hk", "Nuove rotte disponibili", "Bozza pronta"] },
      { cells: ["david.lee@sglogistics.sg", "Partnership update", "Bozza pronta"] },
      { cells: ["maria.santos@manilafreight.ph", "Re: Contratto", "Bozza pronta"] },
      { cells: ["tom.nguyen@hcmcargo.vn", "Opportunità Q2", "Bozza pronta"] },
      { cells: ["sarah.brown@sydneylog.au", "Follow-up conferenza", "Bozza pronta"] },
    ],
  },
  approvalPayload: {
    title: "Invio 10 email follow-up?",
    description:
      "Ho preparato 10 email personalizzate di follow-up per i contatti Asia Pacific. Ogni messaggio è stato adattato sulla base della conversation history e del contesto del partner.",
    details: [
      { label: "Email in coda", value: "10" },
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
    message: "10 email di follow-up inviate con successo ai contatti Asia Pacific.",
    kpis: [
      { label: "Email inviate", value: "10" },
      { label: "Tasso personalizzazione", value: "100%" },
      { label: "Tempo medio composizione", value: "1.3s" },
    ],
  },
};

const agentReport: MockScenario = {
  key: "agent-report",
  canvasData: null,
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

export const mockScenarios: Record<string, MockScenario> = {
  "partner-search": partnerSearch,
  "followup-batch": followupBatch,
  "agent-report": agentReport,
};

export function matchScenario(prompt: string): MockScenario {
  const lower = prompt.toLowerCase();
  if (lower.includes("email") || lower.includes("follow-up") || lower.includes("followup")) {
    return followupBatch;
  }
  if (lower.includes("agent") || lower.includes("riepilogo")) {
    return agentReport;
  }
  return partnerSearch;
}
