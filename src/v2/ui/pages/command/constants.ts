/**
 * Command Page — Types, demo data, scenarios, quick prompts.
 * Extracted from CommandPage.tsx for readability.
 */
import type { ExecutionStep } from "@/components/workspace/ExecutionFlow";

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
}

export type CanvasType =
  | "table" | "campaign" | "report" | "result"
  | "live-table" | "live-card-grid" | "live-timeline" | "live-flow" | "live-composer"
  | "live-approval" | "live-report" | "live-result"
  | null;

export type FlowPhase = "idle" | "thinking" | "proposal" | "approval" | "executing" | "done";
export type ToolPhase = "activating" | "active" | "done";

export interface GovernanceInfo { role: string; permission: string; policy: string }

export interface Scenario {
  key: string;
  assistantMessages: { content: string; agentName: string; meta?: string; governance?: string }[];
  canvas: CanvasType;
  approval?: { title: string; description: string; details: { label: string; value: string }[]; governance?: GovernanceInfo };
  executionSteps?: ExecutionStep[];
  resultCanvas?: CanvasType;
  autoVoice?: boolean;
}

/* ─── Demo Data ─── */
export const tableData = [
  { name: "TechBridge Japan", sector: "Technology", revenue: "€412k", days: "98", churn: 91 },
  { name: "Meridian Asia Pacific", sector: "Consulting", revenue: "€234k", days: "112", churn: 89 },
  { name: "SteelForge Srl", sector: "Manufacturing", revenue: "€187k", days: "105", churn: 85 },
  { name: "NovaPharma Group", sector: "Healthcare", revenue: "€156k", days: "93", churn: 82 },
  { name: "Apex Financial", sector: "Finance", revenue: "€298k", days: "88", churn: 76 },
  { name: "Orion Logistics", sector: "Logistics", revenue: "€143k", days: "120", churn: 71 },
];

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
  "Mostra i partner WCA attivi in Europa",
  "Scrivi email a partner per proposta collaborazione",
  "Report executive partner Asia cross-source",
  "Prepara follow-up per clienti inattivi >30gg",
  "Componi email di primo contatto per nuovo lead",
  "Leggi ad alta voce il riepilogo prima della conferma",
  "Mostra stato campagne attive",
  "Salva questo flusso come template operativo",
];

export const capabilities = [
  "Source Unification", "Search Partners", "Parse Cards", "Create Draft",
  "Send Batch", "Read Aloud", "Audit Action",
];

/* ─── Scenarios ─── */
export const scenarios: Record<string, Scenario> = {
  import: {
    key: "import",
    assistantMessages: [{
      content: "Ho ricevuto il file con 300 contatti. Sto usando la pipeline di import già operativa nel sistema:\n\n**Parse Contact File** → 300 record estratti dal modulo contact ingestion (12 campi per record)\n**Deduplicate & Merge** → 287 profili unici — il motore di deduplicazione ha rimosso 13 duplicati e arricchito 8 con dati già presenti nel CRM Core\n**Run Deep Search** → 42 profili arricchiti tramite il modulo deep search intelligence (fonti esterne attive)\n**Match Partner Network** → 23 contatti collegati a partner WCA tramite il modulo partner management\n\nProfili pronti per l'inserimento. Il CRM Core è già predisposto per riceverli.",
      agentName: "Orchestratore",
      meta: "contact-ingestion · dedup-engine · deep-search · partner-mgmt · crm-core · 5 moduli · 2.3s",
      governance: "Ruolo: Admin · Permesso: Import & Write · Policy: max 500 record/batch",
    }],
    canvas: "table",
    approval: {
      title: "Importare 287 contatti nel CRM?",
      description: "287 profili unici dopo deduplicazione. 23 collegati a partner WCA. 42 arricchiti con Deep Search. Governance check superato.",
      details: [
        { label: "File sorgente", value: "contacts_asia_q1.csv" },
        { label: "Record originali", value: "300" },
        { label: "Dopo deduplicazione", value: "287 unici" },
        { label: "Match partner WCA", value: "23 collegati" },
        { label: "Arricchiti Deep Search", value: "42 profili" },
        { label: "Governance", value: "✓ Conforme · Admin" },
      ],
      governance: { role: "Admin", permission: "Import & Write", policy: "Max 500 record/batch" },
    },
    executionSteps: [
      { label: "Parse Contact File → 300 record", status: "done", detail: "300/300 ✓" },
      { label: "Deduplicate & Merge → 287 unici", status: "done", detail: "13 rimossi" },
      { label: "Deep Search enrichment", status: "done", detail: "42 arricchiti" },
      { label: "Match WCA Partner Network", status: "done", detail: "23 match" },
      { label: "Update CRM Records", status: "running", detail: "189/287" },
      { label: "Audit Action → log importazione", status: "pending" },
    ],
    resultCanvas: "result",
  },
  campaign: {
    key: "campaign",
    assistantMessages: [{
      content: "Ho costruito il target usando il motore campagne e 3 fonti dati già nel sistema:\n\n**Search Contacts** → 32 lead da Imported Contacts (inattivi >90gg) — dal modulo contact database\n**Search Partners** → 11 contatti dal modulo partner management (WCA Network)\n**Parse Business Cards** → 7 profili dal modulo card capture (Business Card Archive)\n**Deduplicate & Merge** → 50 profili unici — il motore di deduplicazione ha unificato le 3 fonti\n**Run Deep Search** → 38 profili arricchiti tramite deep search intelligence\n**Create Email Draft** → 50 bozze generate dal motore email drafting con template esistenti\n\nOgni bozza usa contesto cross-source. Template: Re-engagement Q1.",
      agentName: "Communication",
      meta: "contact-db · partner-mgmt · card-capture · dedup-engine · deep-search · email-draft · 6 moduli · 3.2s",
      governance: "Ruolo: Admin · Permesso: Send Email Batch · Policy: max 100 email/batch · Approval: obbligatorio",
    }],
    canvas: "campaign",
    approval: {
      title: "Avviare invio batch di 50 email?",
      description: "50 email personalizzate da 3 fonti unificate. Governance check completato. Approvazione richiesta per Send Email Batch.",
      details: [
        { label: "Fonti unificate", value: "Import · WCA · Business Card" },
        { label: "Profili target", value: "50 unici (dopo dedup)" },
        { label: "Bozze generate", value: "50 · Create Email Draft" },
        { label: "Arricchimento", value: "38 · Run Deep Search" },
        { label: "Wave", value: "3 (17 · 17 · 16)" },
        { label: "Governance", value: "✓ Admin · Send approved" },
      ],
      governance: { role: "Admin", permission: "Send Email Batch", policy: "Max 100 email/batch" },
    },
    executionSteps: [
      { label: "Validazione contatti · Search Contacts", status: "done", detail: "50/50 ✓" },
      { label: "Generazione bozze · Create Email Draft", status: "done", detail: "50 email" },
      { label: "Governance check · Audit Action", status: "done", detail: "Conforme" },
      { label: "Invio wave 1 · Send Email Batch", status: "running", detail: "12/17" },
      { label: "Invio wave 2 · Send Email Batch", status: "pending" },
      { label: "Invio wave 3 · Send Email Batch", status: "pending" },
      { label: "Audit Action → log esecuzione completa", status: "pending" },
    ],
    resultCanvas: "result",
  },
  report: {
    key: "report",
    assistantMessages: [{
      content: "Ho generato il report usando il modulo reporting e 4 sorgenti dati già operative:\n\n**Search Partners** → 23 partner Asia Pacific dal modulo partner management (WCA Network)\n**Read Company Report** → 12 report analizzati dal modulo workspace documents\n**Analyze Data** → Scoring e trend analysis tramite il motore analytics già presente\n**Generate Executive Report** → Documento formattato dal modulo reporting per presentazione board\n\nProvenance: Partner Management (profili) + Document Workspace (report finanziari) + CRM Core (storico attività) + Deep Search (dati di mercato).",
      agentName: "Data Analyst",
      meta: "partner-mgmt · workspace-docs · analytics · reporting · 4 moduli · 2.8s",
      governance: "Ruolo: Analyst · Permesso: Read & Report · Policy: dati sensibili mascherati",
    }],
    canvas: "report",
  },
  email: {
    key: "email",
    assistantMessages: [{
      content: "Ho generato 10 bozze usando il motore email drafting e i dati già nel sistema:\n\n**Search Contacts** → 6 contatti dal modulo card capture + 4 dal CRM Core\n**Read Company Report** → Contesto aziendale per 8 destinatari dal modulo workspace documents\n**Create Email Draft** → 10 bozze generate dal motore email drafting con personalizzazione cross-source\n**Load Template** → Template \"Follow-up Partner Asia\" caricato dal modulo template memory\n\nOgni bozza include: nome (card capture), azienda (CRM Core), settore (company reports), storico (activity engine).\n\nLe bozze sono nel workspace. Pronte per revisione.",
      agentName: "Communication",
      meta: "contact-db · card-capture · workspace-docs · email-draft · template-memory · 5 moduli · 1.9s",
    }],
    canvas: null,
  },
  churn: {
    key: "churn",
    assistantMessages: [{
      content: "Ho incrociato 3 sorgenti dati usando i moduli operativi già attivi nel sistema:\n\n**Search Partners** → 234 partner dal modulo partner management (WCA Network)\n**Search Contacts** → 12.847 contatti dal modulo contact database unificato\n**Run Deep Search** → Arricchimento con 89 company report tramite deep search intelligence\n**Run ML Scoring** → Churn scoring su 34 account tramite il motore analytics\n**Generate Report** → 6 account critici identificati (score ≥85) dal modulo reporting\n\nOrigini: Partner Management → 4 partner, Contact Database → 18, Workspace Documents → 3 analisi.",
      agentName: "Orchestratore",
      meta: "partner-mgmt · contact-db · deep-search · analytics · reporting · 5 moduli · 1.7s",
      governance: "Ruolo: Analyst · Permesso: Read · Policy: nessuna azione distruttiva",
    }],
    canvas: "table",
  },
  voice: {
    key: "voice",
    autoVoice: true,
    assistantMessages: [{
      content: "Preparo la lettura vocale usando il modulo voice interaction già integrato:\n\n**Load Context** → Caricamento ultimo riepilogo dal modulo conversation memory\n**Read Aloud** → Attivazione del modulo voice con ElevenLabs TTS premium\n\nIl sistema leggerà il riepilogo completo prima della conferma. Puoi interrompere in qualsiasi momento.",
      agentName: "Voice",
      meta: "conversation-memory · voice-interaction · tts-engine · 3 moduli · 0.4s",
    }],
    canvas: null,
  },
  batch: {
    key: "batch",
    assistantMessages: [{
      content: "Preparo l'invio batch con approvazione step-by-step:\n\n**Search Contacts** → 120 contatti selezionati da 3 fonti\n**Validate & Deduplicate** → 118 profili validi, 2 rimossi\n**Create Email Draft** → 118 bozze generate con personalizzazione\n**Governance Check** → Verifica limiti, ruoli e policy completata\n\nL'invio sarà diviso in 4 wave con approvazione intermedia. Ogni wave richiede conferma esplicita.",
      agentName: "Automation",
      meta: "Search Contacts · Validate · Create Draft · Governance Check · Send Batch · 6 tool · 2.9s",
      governance: "Ruolo: Admin · Permesso: Send Batch · Policy: max 50/wave · Approval: per-wave obbligatorio",
    }],
    canvas: null,
    approval: {
      title: "Avviare invio batch di 118 email in 4 wave?",
      description: "118 email pronte. Ogni wave richiede approvazione. Governance Agent monitora ogni step. Audit trail completo.",
      details: [
        { label: "Contatti validati", value: "118 / 120" },
        { label: "Wave pianificate", value: "4 (30 · 30 · 30 · 28)" },
        { label: "Approvazione", value: "Per-wave obbligatoria" },
        { label: "Tool attivi", value: "Send Email Batch · Audit Action" },
        { label: "Governance", value: "✓ Admin · Conforme" },
      ],
      governance: { role: "Admin", permission: "Send Batch", policy: "Max 50 email/wave" },
    },
    executionSteps: [
      { label: "Validazione contatti", status: "done", detail: "118/118 ✓" },
      { label: "Governance pre-check", status: "done", detail: "Conforme" },
      { label: "Wave 1 · Send Email Batch", status: "done", detail: "30/30 ✓" },
      { label: "Wave 2 · Send Email Batch", status: "running", detail: "18/30" },
      { label: "Wave 3 · Send Email Batch", status: "pending" },
      { label: "Wave 4 · Send Email Batch", status: "pending" },
      { label: "Audit Action → log completo", status: "pending" },
    ],
    resultCanvas: "result",
  },
  template: {
    key: "template",
    assistantMessages: [{
      content: "Analizzo il flusso corrente per creare un template operativo riutilizzabile:\n\n**Save Template** → Flusso serializzato con tutti gli step, tool e parametri\n**Audit Action** → Creazione template registrata nel log\n\nIl template sarà disponibile nella Template Library per esecuzioni future con un click.",
      agentName: "Orchestratore",
      meta: "Save Template · Audit Action · 2 tool · 0.3s",
      governance: "Ruolo: Admin · Permesso: Template Management · Policy: versioning attivo",
    }],
    canvas: null,
    resultCanvas: "result",
    approval: {
      title: "Salvare questo flusso come template?",
      description: "Il template includerà tutti gli step, tool e parametri del flusso corrente. Sarà riutilizzabile dalla Template Library.",
      details: [
        { label: "Step inclusi", value: "6" },
        { label: "Tool mappati", value: "4" },
        { label: "Parametri", value: "Configurabili" },
        { label: "Audit", value: "✓ Registrato" },
      ],
      governance: { role: "Admin", permission: "Template Management", policy: "Versioning attivo" },
    },
    executionSteps: [
      { label: "Analisi flusso corrente", status: "done", detail: "6 step" },
      { label: "Serializzazione template", status: "done", detail: "✓" },
      { label: "Save Template → Library", status: "running" },
      { label: "Audit Action → log creazione", status: "pending" },
    ],
  },
};

export async function detectScenario(text: string): Promise<string | null> {
  const { resolveTool } = await import("./tools/registry");
  const lower = text.toLowerCase();
  const tool = await resolveTool(text);
  if (tool) return null;
  if (lower.includes("template") || lower.includes("salva questo flusso")) return "template";
  if (lower.includes("batch") || lower.includes("invio batch")) return "batch";
  if (lower.includes("importa") || lower.includes("uniscili")) return "import";
  if (lower.includes("business card") || lower.includes("bigliett")) return "businesscard";
  if (lower.includes("campagna") || lower.includes("lead")) return "campaign";
  if (lower.includes("report") || lower.includes("asia") || lower.includes("board")) return "report";
  if (lower.includes("bozze") || lower.includes("email") || lower.includes("draft")) return "email";
  if (lower.includes("leggi") || lower.includes("voce") || lower.includes("alta voce")) return "voice";
  return "churn";
}
