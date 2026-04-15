import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Wand2, Mic, MicOff, Volume2, VolumeX, Globe2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import AiEntity from "@/components/ai/AiEntity";
import ApprovalPanel from "@/components/workspace/ApprovalPanel";
import ExecutionFlow, { type ExecutionStep } from "@/components/workspace/ExecutionFlow";
import ToolActivationBar from "@/components/workspace/ToolActivationBar";
import VoicePresence from "@/components/workspace/VoicePresence";
import { TableCanvas, CampaignCanvas, ReportCanvas, ResultCanvas } from "@/components/workspace/CanvasViews";
import CardGridCanvas from "./command/canvas/CardGridCanvas";
import TimelineCanvas from "./command/canvas/TimelineCanvas";
import FlowCanvas from "./command/canvas/FlowCanvas";
import ComposerCanvas from "./command/canvas/ComposerCanvas";
import FloatingDock from "@/components/layout/FloatingDock";
import { resolveTool, TOOLS, TOOL_METADATA } from "./command/tools/registry";
import type { ToolResult } from "./command/tools/types";
import { useGovernance } from "./command/hooks/useGovernance";
import { useVoiceInput } from "./command/hooks/useVoiceInput";
import { planExecution } from "@/v2/io/edge/aiAssistant";
import { executePlan, type PlanExecutionState } from "./command/planRunner";

const ease = [0.2, 0.8, 0.2, 1] as const;

/* ─── Types ─── */
interface Message {
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

type CanvasType = "table" | "campaign" | "report" | "result" | "live-table" | "live-card-grid" | "live-timeline" | "live-flow" | "live-composer" | "live-approval" | "live-report" | "live-result" | null;
type FlowPhase = "idle" | "thinking" | "proposal" | "approval" | "executing" | "done";
type ToolPhase = "activating" | "active" | "done";

/* ─── Demo Data ─── */
const tableData = [
  { name: "TechBridge Japan", sector: "Technology", revenue: "€412k", days: "98", churn: 91 },
  { name: "Meridian Asia Pacific", sector: "Consulting", revenue: "€234k", days: "112", churn: 89 },
  { name: "SteelForge Srl", sector: "Manufacturing", revenue: "€187k", days: "105", churn: 85 },
  { name: "NovaPharma Group", sector: "Healthcare", revenue: "€156k", days: "93", churn: 82 },
  { name: "Apex Financial", sector: "Finance", revenue: "€298k", days: "88", churn: 76 },
  { name: "Orion Logistics", sector: "Logistics", revenue: "€143k", days: "120", churn: 71 },
];

const agentDots = [
  { agent: "Orchestratore", status: "done" },
  { agent: "CRM Core", status: "done" },
  { agent: "Partner Scout", status: "done" },
  { agent: "Outreach Runner", status: "running" },
  { agent: "Follow-up Watcher", status: "monitoring" },
  { agent: "Automation", status: "done" },
  { agent: "Governance", status: "monitoring" },
];

const quickPrompts = [
  "Mostra i partner WCA attivi in Europa",
  "Scrivi email a partner per proposta collaborazione",
  "Report executive partner Asia cross-source",
  "Prepara follow-up per clienti inattivi >30gg",
  "Componi email di primo contatto per nuovo lead",
  "Leggi ad alta voce il riepilogo prima della conferma",
  "Mostra stato campagne attive",
  "Salva questo flusso come template operativo",
];

/* ─── Scenarios ─── */
interface GovernanceInfo { role: string; permission: string; policy: string }
interface Scenario {
  key: string;
  assistantMessages: { content: string; agentName: string; meta?: string; governance?: string }[];
  canvas: CanvasType;
  approval?: { title: string; description: string; details: { label: string; value: string }[]; governance?: GovernanceInfo };
  executionSteps?: ExecutionStep[];
  resultCanvas?: CanvasType;
  autoVoice?: boolean;
}

const scenarios: Record<string, Scenario> = {
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

async function detectScenario(text: string): Promise<string | null> {
  const lower = text.toLowerCase();
  // Check for real tool match first (async now)
  const tool = await resolveTool(text);
  if (tool) return null; // null = use live tool
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

/* ─── Component ─── */
const CommandPage = () => {
  const nav = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [voiceSpeaking, setVoiceSpeaking] = useState(false);

  // Voice input hook — real Web Speech API
  const voice = useVoiceInput({
    onTranscript: (text) => setInput(text),
    onAutoSubmit: (text) => {
      setInput("");
      sendMessage(text);
    },
    silenceMs: 2000,
    lang: "it-IT",
  });

  useEffect(() => {
    if (voice.error) {
      toast.error(voice.error);
    }
  }, [voice.error]);
  const [inputFocused, setInputFocused] = useState(false);
  const [lang, setLang] = useState<"it" | "en">("it");
  const [canvas, setCanvas] = useState<CanvasType>(null);
  const [flowPhase, setFlowPhase] = useState<FlowPhase>("idle");
  const [activeScenario, setActiveScenario] = useState<Scenario | null>(null);
  const [activeScenarioKey, setActiveScenarioKey] = useState<string | null>(null);
  const [showTools, setShowTools] = useState(false);
  const [toolPhase, setToolPhase] = useState<ToolPhase>("active");
  const [chainHighlight, setChainHighlight] = useState<number | undefined>(undefined);
  const [execProgress, setExecProgress] = useState(0);
  const [execSteps, setExecSteps] = useState<ExecutionStep[]>([]);
  const [liveResult, setLiveResult] = useState<ToolResult | null>(null);
  const [pendingApproval, setPendingApproval] = useState<{ toolId: string; payload: Record<string, unknown>; prompt: string } | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const governance = useGovernance(activeScenarioKey ?? undefined);
  const isEmpty = messages.length === 0;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const ts = () => new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

  const addMessage = useCallback((msg: Omit<Message, "id">) => {
    setMessages((prev) => [...prev, { ...msg, id: Date.now() + Math.random() }]);
  }, []);

  const runLiveTool = useCallback(async (prompt: string) => {
    const tool = await resolveTool(prompt);
    if (!tool) {
      addMessage({
        role: "assistant",
        content: "Non ho capito cosa vuoi fare. Puoi riformulare la richiesta?",
        timestamp: ts(),
        agentName: "Orchestratore",
      });
      return false;
    }

    setFlowPhase("thinking");
    setShowTools(true);
    setToolPhase("activating");
    setChainHighlight(0);
    setActiveScenarioKey("churn");

    addMessage({ role: "assistant", content: "", timestamp: "", thinking: true });

    // Thinking phase
    const chainInterval = setInterval(() => {
      setChainHighlight(prev => {
        if (prev === undefined || prev >= 2) return prev;
        return prev + 1;
      });
    }, 700);

    await new Promise(r => setTimeout(r, 1500));
    clearInterval(chainInterval);

    setMessages(prev => prev.filter(m => !m.thinking));
    setToolPhase("active");
    setChainHighlight(3);

    const isCardGrid = tool.id === "followup-batch";
    const isTimeline = tool.id === "agent-report";
    const isFlow = tool.id === "campaign-status";
    const isComposer = tool.id === "compose-email";
    const agentLabel = isComposer ? "Email Composer" : isFlow ? "Campaign Manager" : isTimeline ? "Agent Monitor" : isCardGrid ? "Follow-up Watcher" : "Partner Scout";
    const queryLabel = isComposer ? "Preparazione Composer" : isFlow ? "Query Supabase · Campaign Jobs" : isTimeline ? "Query Supabase · Agents + Activities" : isCardGrid ? "Query Supabase · Search Contacts" : "Query Supabase · Search Partners";

    addMessage({
      role: "assistant",
      content: isComposer
        ? `Sto preparando il composer email...\n\nAnalisi del prompt per estrarre destinatario e oggetto.`
        : isFlow
        ? `Sto analizzando lo stato delle campagne usando **Campaign Jobs**...\n\nAggregazione batch in corso.`
        : isTimeline
        ? `Sto aggregando le attività degli agenti negli ultimi 7 giorni usando **Agents + Activities**...\n\nReport in preparazione.`
        : isCardGrid
        ? `Sto cercando contatti inattivi nel database usando **Search Contacts**...\n\nFiltro: nessuna interazione negli ultimi 30 giorni.`
        : `Sto cercando partner nel database WCA usando **Search Partners**...\n\nQuery in corso tramite il modulo partner management.`,
      agentName: agentLabel,
      timestamp: ts(),
      meta: isComposer ? "composer · generate-email + send-email · 2 edge fn" : isFlow ? "campaign-mgr · campaign_jobs · 1 modulo" : isTimeline ? "agent-monitor · agents+activities · 2 moduli" : isCardGrid ? "contact-db · search-contacts · 1 modulo" : "partner-mgmt · search-partners · 1 modulo",
      governance: `Ruolo: ${governance.role} · Permesso: ${governance.permission} · Policy: ${governance.policy}`,
    });

    setFlowPhase("executing");
    setChainHighlight(5);

    const liveSteps: ExecutionStep[] = [
      { label: "Interpretazione richiesta", status: "done" },
      { label: queryLabel, status: "running" },
      { label: "Rendering canvas", status: "pending" },
    ];
    setExecSteps(liveSteps);
    setExecProgress(33);

    try {
      const result = await tool.execute(prompt);

      // Handle approval kind — show ApprovalPanel instead of canvas
      if (result.kind === "approval") {
        setExecSteps([
          { label: "Interpretazione richiesta", status: "done" },
          { label: queryLabel, status: "done", detail: "Approvazione richiesta" },
          { label: "In attesa conferma utente", status: "running" },
        ]);
        setExecProgress(66);
        setLiveResult(result);
        setPendingApproval({ toolId: result.toolId, payload: result.pendingPayload, prompt });
        setFlowPhase("proposal");
        setCanvas("live-approval");
        setShowTools(false);

        addMessage({
          role: "assistant",
          content: `**${result.title}**\n${result.description}\n\nApprovazione richiesta prima dell'esecuzione.`,
          agentName: agentLabel,
          timestamp: ts(),
          meta: `governance · ${result.governance.permission}`,
          governance: `Ruolo: ${result.governance.role} · Permesso: ${result.governance.permission} · Policy: ${result.governance.policy}`,
        });
        return true;
      }

      // Handle result kind — toast + close
      if (result.kind === "result") {
        setExecSteps([
          { label: "Interpretazione richiesta", status: "done" },
          { label: queryLabel, status: "done" },
          { label: "Operazione completata", status: "done" },
        ]);
        setExecProgress(100);
        setFlowPhase("done");
        setShowTools(false);
        toast.success(result.message);
        addMessage({
          role: "assistant",
          content: `✅ **${result.title}**\n${result.message}`,
          agentName: agentLabel,
          timestamp: ts(),
          meta: result.meta?.sourceLabel,
        });
        return true;
      }

      // Handle report kind
      if (result.kind === "report") {
        setExecSteps([
          { label: "Interpretazione richiesta", status: "done" },
          { label: queryLabel, status: "done", detail: `${result.sections.length} sezioni` },
          { label: "Rendering report", status: "done" },
        ]);
        setExecProgress(100);
        setLiveResult(result);
        setFlowPhase("done");
        setCanvas("live-report");
        setShowTools(false);
        addMessage({
          role: "assistant",
          content: `Report generato con **${result.sections.length} sezioni**.\n\nDati da: ${result.meta?.sourceLabel ?? "AI"}`,
          agentName: agentLabel,
          timestamp: ts(),
          meta: result.meta?.sourceLabel,
        });
        return true;
      }

      setExecSteps([
        { label: "Interpretazione richiesta", status: "done" },
        { label: queryLabel, status: "done", detail: `${result.meta?.count ?? 0} risultati` },
        { label: "Rendering canvas", status: "done" },
      ]);
      setExecProgress(100);
      setLiveResult(result);

      await new Promise(r => setTimeout(r, 400));

      setFlowPhase("done");
      setChainHighlight(6);
      setCanvas(isComposer ? "live-composer" : isFlow ? "live-flow" : isTimeline ? "live-timeline" : isCardGrid ? "live-card-grid" : "live-table");
      setShowTools(false);

      const countLabel = isComposer
        ? "Composer pronto"
        : isFlow
        ? `${result.meta?.count ?? 0} job in ${result.kind === "flow" ? result.nodes.length / 2 : 0} batch`
        : isTimeline
        ? `${result.meta?.count ?? 0} attività negli ultimi 7gg`
        : isCardGrid
        ? `${result.kind === "card-grid" ? result.cards.length : 0} contatti inattivi`
        : `${result.meta?.count ?? 0} risultati`;

      addMessage({
        role: "assistant",
        content: `Trovati **${countLabel}** nel database. Canvas aggiornato con i risultati live.\n\nDati da: ${result.meta?.sourceLabel ?? "Supabase"}`,
        agentName: agentLabel,
        timestamp: ts(),
        meta: `${result.meta?.sourceLabel ?? "Supabase"} · ${result.meta?.count ?? 0} record · LIVE`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Errore sconosciuto";
      setExecSteps([
        { label: "Interpretazione richiesta", status: "done" },
        { label: queryLabel, status: "error", detail: "FAIL" },
        { label: "Rendering canvas", status: "pending" },
      ]);
      toast.error(msg);
      addMessage({
        role: "assistant",
        content: `Errore nella query: ${msg}`,
        agentName: agentLabel,
        timestamp: ts(),
      });
      setFlowPhase("idle");
      setShowTools(false);
    }

    return true;
  }, [addMessage, governance]);

  const runFlow = useCallback((scenarioKey: string) => {
    const scenario = scenarios[scenarioKey];
    if (!scenario) return;
    setActiveScenario(scenario);
    setActiveScenarioKey(scenarioKey);
    setFlowPhase("thinking");
    setShowTools(true);
    setToolPhase("activating");
    setChainHighlight(0);

    addMessage({ role: "assistant", content: "", timestamp: "", thinking: true });

    const chainInterval = setInterval(() => {
      setChainHighlight(prev => {
        if (prev === undefined || prev >= 2) return prev;
        return prev + 1;
      });
    }, 700);

    setTimeout(() => {
      clearInterval(chainInterval);
      setToolPhase("active");
      setChainHighlight(3);
      setMessages((prev) => prev.filter((m) => !m.thinking));
      scenario.assistantMessages.forEach((am) => {
        addMessage({ role: "assistant", content: am.content, timestamp: ts(), agentName: am.agentName, meta: am.meta, governance: am.governance });
      });
      setCanvas(scenario.canvas);
      setFlowPhase(scenario.approval ? "proposal" : "done");

      if (scenario.autoVoice) {
        setTimeout(() => setVoiceSpeaking(true), 800);
      }
    }, 2200);
  }, [addMessage]);

  const handleApprove = useCallback(async () => {
    // Live tool approval flow
    if (pendingApproval) {
      const tool = TOOLS.find(t => t.id === pendingApproval.toolId);
      if (!tool) return;
      setFlowPhase("executing");
      setCanvas(null);
      setPendingApproval(null);
      addMessage({ role: "assistant", content: "Esecuzione in corso...", timestamp: ts(), agentName: "Automation" });
      try {
        const result = await tool.execute(pendingApproval.prompt, { confirmed: true, payload: pendingApproval.payload });
        if (result.kind === "result") {
          toast.success(result.message);
          addMessage({ role: "assistant", content: `✅ **${result.title}**\n${result.message}`, agentName: "Automation", timestamp: ts(), meta: result.meta?.sourceLabel });
        }
        setFlowPhase("done");
        setLiveResult(null);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Errore";
        toast.error(msg);
        addMessage({ role: "assistant", content: `❌ Errore: ${msg}`, agentName: "Automation", timestamp: ts() });
        setFlowPhase("idle");
      }
      return;
    }
    if (!activeScenario) return;
    setFlowPhase("executing");
    setCanvas(null);
    setChainHighlight(5);

    addMessage({
      role: "assistant",
      content: "Esecuzione avviata. Automation Agent coordina gli step operativi. Governance Agent monitora ogni azione con audit trail completo.",
      timestamp: ts(),
      agentName: "Automation",
      meta: "Execution Engine · Governance · Audit Action · attivo",
    });

    if (activeScenario.executionSteps) {
      setExecSteps(activeScenario.executionSteps);
      setExecProgress(0);
      const steps = [...activeScenario.executionSteps];
      let progress = 0;
      const interval = setInterval(() => {
        progress += 12;
        if (progress > 100) progress = 100;
        setExecProgress(progress);
        const updated = steps.map((s, i) => {
          if (progress > (i + 1) * (100 / steps.length)) return { ...s, status: "done" as const, detail: s.detail || "✓" };
          if (progress > i * (100 / steps.length)) return { ...s, status: "running" as const };
          return s;
        });
        setExecSteps(updated);
        if (progress >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setFlowPhase("done");
            setChainHighlight(6);
            setCanvas(activeScenario.resultCanvas || null);
            setShowTools(false);
            setToolPhase("done");
            addMessage({
              role: "assistant",
              content: "Esecuzione completata. Tutti gli step verificati dal Governance Agent. Audit log aggiornato.\n\nVuoi salvare questo flusso come template operativo?",
              timestamp: ts(),
              agentName: "Orchestratore",
            });
          }, 600);
        }
      }, 700);
    }
  }, [activeScenario, addMessage]);

  const handleCancel = useCallback(() => {
    setFlowPhase("idle");
    setCanvas(null);
    setShowTools(false);
    setChainHighlight(undefined);
    setLiveResult(null);
    setPendingApproval(null);
    toast("Azione annullata");
    addMessage({ role: "assistant", content: "Operazione annullata. Nessuna azione eseguita. Audit Action: cancellazione registrata.", timestamp: ts(), agentName: "Orchestratore" });
  }, [addMessage]);

  const sendMessage = async (text?: string) => {
    const content = text || input.trim();
    if (!content) return;
    addMessage({ role: "user", content, timestamp: ts() });
    setInput("");
    setCanvas(null);
    setFlowPhase("idle");
    setShowTools(false);
    setVoiceSpeaking(false);
    setChainHighlight(undefined);
    setLiveResult(null);

    const scenarioKey = await detectScenario(content);
    if (scenarioKey === null) {
      // Live tool
      await runLiveTool(content);
    } else {
      runFlow(scenarioKey);
    }
  };

  return (
    <div className="dark min-h-screen w-full bg-background text-foreground relative overflow-hidden flex flex-col">
      {/* Fixed back button */}
      <motion.button
        onClick={() => nav("/v2")}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed top-6 left-6 z-50 flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] text-muted-foreground/80 hover:text-foreground hover:bg-white/5 transition-all backdrop-blur-md border border-white/[0.06]"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Dashboard</span>
      </motion.button>

      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <motion.div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full"
          style={{ background: "radial-gradient(circle, hsl(210 100% 66% / 0.012), transparent 70%)" }}
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 relative z-10 flex-shrink-0">
        <div className="flex items-center gap-3 ml-28">
          <motion.div className="w-1.5 h-1.5 rounded-full bg-primary/95" animate={{ opacity: [0.5, 0.85, 0.5] }} transition={{ duration: 3, repeat: Infinity }} />
          <span className="text-[11px] text-muted-foreground/98 font-light tracking-wide">Sessione attiva</span>
          {flowPhase !== "idle" && flowPhase !== "done" && (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[9px] text-primary/92 font-mono ml-2">
              {flowPhase === "thinking" ? "ELABORAZIONE" : flowPhase === "proposal" ? "PROPOSTA" : flowPhase === "approval" ? "IN ATTESA" : "ESECUZIONE"}
            </motion.span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 mr-2">
            {agentDots.map((a) => (
              <motion.div
                key={a.agent}
                className={`w-1.5 h-1.5 rounded-full ${a.status === "done" ? "bg-success/90" : a.status === "running" ? "bg-primary/95" : "bg-muted-foreground/20"}`}
                animate={a.status === "running" ? { opacity: [0.55, 0.9, 0.55] } : {}}
                transition={{ duration: 1.5, repeat: Infinity }}
                title={a.agent}
              />
            ))}
          </div>
          <span className="text-[8px] text-muted-foreground/100 font-mono tracking-wider">14 fonti · 12.8k contatti · 234 partner · 7 agenti</span>
          <motion.button
            onClick={() => setLang(lang === "it" ? "en" : "it")}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="ml-2 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[hsl(270_60%_60%)]/10 border border-[hsl(270_60%_60%)]/20 text-[hsl(270_60%_70%)] hover:bg-[hsl(270_60%_60%)]/15 transition-all duration-300"
            title="Cambia lingua"
          >
            <Globe2 className="w-3 h-3" />
            <span className="text-[9px] font-semibold tracking-wider uppercase">{lang === "it" ? "IT" : "EN"}</span>
          </motion.button>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        {/* ─── CONVERSATION ─── */}
        <div className={`flex-1 flex flex-col transition-all duration-700 ease-out ${canvas ? "max-w-[50%]" : ""}`}>
          {isEmpty ? (
            <div className="flex-1 flex flex-col items-center justify-center px-8">
              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.5, ease }} className="mb-10">
                <AiEntity size="lg" />
              </motion.div>
              <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, ease }} className="text-2xl font-extralight tracking-tight text-foreground/100 mb-2">
                Cosa vuoi ottenere?
              </motion.h2>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="text-[13px] text-muted-foreground/98 font-light mb-10 text-center max-w-sm">
                14 sorgenti unificate · 12.847 contatti · 234 partner WCA · 1.420 business card
              </motion.p>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }} className="flex flex-col items-center gap-2">
                {quickPrompts.map((p, i) => (
                  <motion.button
                    key={p}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1 + i * 0.1, ease }}
                    onClick={() => sendMessage(p)}
                    whileHover={{ x: 4 }}
                    className="text-[12px] px-4 py-2.5 rounded-2xl text-muted-foreground/97 hover:text-muted-foreground/98 hover:bg-secondary/[0.1] transition-all duration-700 text-left"
                  >
                    → {p}
                  </motion.button>
                ))}
              </motion.div>
              {/* Capability hint */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.8 }} className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-12">
                {["Source Unification", "Search Partners", "Parse Cards", "Create Draft", "Send Batch", "Read Aloud", "Audit Action"].map((cap, i) => (
                  <motion.span key={cap} className="text-[9px] text-muted-foreground/100 font-light" animate={{ opacity: [0.4, 0.7, 0.4] }} transition={{ duration: 4, repeat: Infinity, delay: i * 0.5 }}>
                    {cap}
                  </motion.span>
                ))}
              </motion.div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-8 py-6">
              <div className="max-w-xl mx-auto space-y-6">
                <ToolActivationBar
                  scenarioKey={activeScenarioKey}
                  visible={showTools && flowPhase !== "idle"}
                  phase={toolPhase}
                  chainHighlight={chainHighlight}
                />

                {messages.map((msg) => (
                  <AnimatePresence key={msg.id}>
                    {msg.thinking ? (
                      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.4, ease }} className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-1"><AiEntity size="sm" /></div>
                        <div className="flex items-center gap-2 px-5 py-4">
                          {[0, 1, 2].map((dot) => (
                            <motion.div key={dot} className="w-1.5 h-1.5 rounded-full bg-primary/95" animate={{ opacity: [0.2, 0.7, 0.2], scale: [0.8, 1.1, 0.8] }} transition={{ duration: 1.2, repeat: Infinity, delay: dot * 0.2 }} />
                          ))}
                          <span className="text-[11px] text-muted-foreground/100 ml-2 font-light">Attivo tool operativi...</span>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.6, ease }}
                        className={`flex items-start gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
                      >
                        {msg.role === "assistant" && (
                          <div className="flex-shrink-0 mt-1"><AiEntity size="sm" pulse={false} /></div>
                        )}
                        <motion.div
                          className={`max-w-[85%] relative ${msg.role === "user" ? "px-5 py-4 rounded-2xl rounded-br-lg" : "px-5 py-4 rounded-2xl rounded-bl-lg"}`}
                          style={{
                            background: msg.role === "assistant" ? "hsl(240 5% 6% / 0.7)" : "hsl(240 5% 8% / 0.65)",
                            border: `1px solid hsl(0 0% 100% / ${msg.role === "assistant" ? "0.16" : "0.12"})`,
                            backdropFilter: "blur(40px)",
                            boxShadow: msg.role === "assistant" ? "0 0 60px hsl(210 100% 66% / 0.1), 0 20px 50px -20px hsl(0 0% 0% / 0.94)" : "none",
                          }}
                        >
                          {msg.agentName && (
                            <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }} className="text-[10px] text-primary/100 font-mono mb-2.5 tracking-[0.2em] uppercase">
                              {msg.agentName}
                            </motion.div>
                          )}
                          <div className="text-[14px] leading-[1.7] whitespace-pre-line font-light text-foreground/100">
                            {msg.content.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
                              part.startsWith("**") && part.endsWith("**")
                                ? <span key={i} className="text-primary/92 font-mono text-[12px]">{part.slice(2, -2)}</span>
                                : <span key={i}>{part}</span>
                            )}
                          </div>
                          {msg.meta && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="flex items-center gap-2 mt-3 pt-2 border-t border-border/[0.16]">
                              <Wand2 className="w-2.5 h-2.5 text-primary/92" />
                              <span className="text-[10px] text-muted-foreground/100 font-light font-mono">{msg.meta}</span>
                            </motion.div>
                          )}
                          {msg.governance && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="flex items-center gap-2 mt-1.5">
                              <div className="w-1 h-1 rounded-full bg-success/90" />
                              <span className="text-[9px] text-muted-foreground/100 font-mono">{msg.governance}</span>
                            </motion.div>
                          )}
                          <span className="text-[10px] text-muted-foreground/100 mt-2 block">{msg.timestamp}</span>
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                ))}

                {activeScenario?.approval && (flowPhase === "proposal" || flowPhase === "approval") && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                    <ApprovalPanel
                      visible
                      title={activeScenario.approval.title}
                      description={activeScenario.approval.description}
                      details={activeScenario.approval.details}
                      governance={activeScenario.approval.governance}
                      onApprove={handleApprove}
                      onModify={() => {}}
                      onCancel={handleCancel}
                    />
                  </motion.div>
                )}

                <ExecutionFlow visible={flowPhase === "executing"} steps={execSteps} progress={execProgress} />

                <div ref={chatEndRef} />
              </div>
            </div>
          )}

          {/* Voice presence */}
          <VoicePresence active={voiceSpeaking || voice.listening} listening={voice.listening && !voice.speaking} speaking={voice.speaking || voiceSpeaking} />

          {/* Input */}
          <div className="px-8 pb-20 pt-2">
            <div className="max-w-xl mx-auto">
              <motion.div
                animate={{ boxShadow: inputFocused ? "0 0 0 1px hsl(210 100% 66% / 0.24), 0 0 60px hsl(210 100% 66% / 0.12)" : "0 0 0 1px hsl(0 0% 100% / 0.1)" }}
                transition={{ duration: 0.6 }}
                className="flex items-center gap-3 rounded-2xl px-4 py-3"
                style={{ background: "hsl(240 5% 6% / 0.75)", backdropFilter: "blur(40px)", border: "1px solid hsl(0 0% 100% / 0.1)" }}
              >
                <motion.button
                  onClick={() => setVoiceSpeaking(!voiceSpeaking)}
                  whileTap={{ scale: 0.9 }}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-500 flex-shrink-0 ${voiceSpeaking ? "bg-[hsl(270_60%_60%)]/15 text-[hsl(270_60%_70%)]" : "text-muted-foreground/100 hover:text-foreground/100"}`}
                  title="Lettura vocale"
                >
                  {voiceSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </motion.button>
                <motion.button
                  onClick={() => voice.toggle()}
                  whileTap={{ scale: 0.9 }}
                  disabled={!voice.supported}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-500 flex-shrink-0 ${voice.listening ? "bg-primary/20 text-primary animate-pulse" : "text-muted-foreground/100 hover:text-foreground/100"} ${!voice.supported ? "opacity-30 cursor-not-allowed" : ""}`}
                  title={voice.supported ? (voice.listening ? "Stop registrazione" : "Registrazione vocale") : "Voce non supportata da questo browser"}
                >
                  {voice.listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </motion.button>
                <input
                  type="text"
                  placeholder="Scrivi un obiettivo..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                  className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground/80 font-light text-foreground/100"
                />
                <motion.button
                  onClick={() => { /* Wand2 action placeholder */ }}
                  whileTap={{ scale: 0.9 }}
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-500 flex-shrink-0 text-[hsl(270_60%_70%)] hover:bg-[hsl(270_60%_60%)]/10"
                  title="Suggerimento AI"
                >
                  <Wand2 className="w-4 h-4" />
                </motion.button>
                <motion.button onClick={() => sendMessage()} disabled={!input.trim()} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.9 }} className="w-9 h-9 rounded-xl flex items-center justify-center bg-primary/10 text-primary/92 hover:bg-primary/15 hover:text-primary/96 transition-all duration-500 disabled:opacity-20">
                  <Send className="w-3.5 h-3.5" />
                </motion.button>
              </motion.div>
            </div>
          </div>
        </div>

        {/* ─── CANVAS ─── */}
        <AnimatePresence>
          {canvas && (
            <motion.div
              initial={{ opacity: 0, x: 60, scale: 0.95, filter: "blur(10px)" }}
              animate={{ opacity: 1, x: 0, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, x: 60, scale: 0.95, filter: "blur(10px)" }}
              transition={{ duration: 0.7, ease }}
              className="w-[50%] p-4 overflow-y-auto"
            >
              {canvas === "table" && <TableCanvas data={tableData} onClose={() => setCanvas(null)} />}
              {canvas === "campaign" && <CampaignCanvas onClose={() => setCanvas(null)} />}
              {canvas === "report" && <ReportCanvas onClose={() => setCanvas(null)} />}
              {canvas === "result" && <ResultCanvas onClose={() => setCanvas(null)} scenarioKey={activeScenarioKey || undefined} />}
              {canvas === "live-table" && liveResult && (
                <TableCanvas
                  data={liveResult.kind === "table" ? liveResult.rows.map((r: Record<string, string | number | null>) => ({
                    name: String(r["companyName"] ?? r["name"] ?? ""),
                    sector: String(r["countryName"] ?? r["country"] ?? ""),
                    revenue: String(r["email"] ?? "—"),
                    days: String(r["city"] ?? "—"),
                    churn: Number(r["rating"] ?? 0),
                  })) : []}
                  onClose={() => { setCanvas(null); setLiveResult(null); }}
                  title={`LIVE · ${liveResult.meta?.count ?? 0} partner · ${liveResult.meta?.sourceLabel ?? "Supabase"}`}
                />
              )}
              {canvas === "live-card-grid" && liveResult && liveResult.kind === "card-grid" && (
                <div className="float-panel p-6 rounded-2xl">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[13px] font-light text-foreground">{liveResult.title}</h3>
                    <button onClick={() => { setCanvas(null); setLiveResult(null); }} className="text-muted-foreground/60 hover:text-foreground text-[10px]">✕</button>
                  </div>
                  <CardGridCanvas
                    items={liveResult.cards.map(c => ({
                      name: c.title,
                      company: c.subtitle,
                      lastContact: c.lastContact
                        ? `${Math.round((Date.now() - new Date(c.lastContact).getTime()) / (1000 * 60 * 60 * 24))} giorni fa`
                        : "Mai contattato",
                      action: c.suggestedAction,
                      meta: [...c.meta],
                    }))}
                    title={`${liveResult.cards.length} contatti inattivi`}
                    badge="LIVE"
                    sourceLabel={liveResult.meta?.sourceLabel}
                  />
                </div>
              )}
              {canvas === "live-timeline" && liveResult && liveResult.kind === "timeline" && (
                <div className="float-panel p-6 rounded-2xl">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-semibold tracking-wider bg-success/20 text-success">LIVE</span>
                      <h3 className="text-[13px] font-light text-foreground">{liveResult.title}</h3>
                    </div>
                    <button onClick={() => { setCanvas(null); setLiveResult(null); }} className="text-muted-foreground/60 hover:text-foreground text-[10px]">✕</button>
                  </div>
                  {liveResult.meta?.sourceLabel && (
                    <div className="text-[9px] text-muted-foreground/60 font-mono mb-3">{liveResult.meta.sourceLabel} · {liveResult.meta.count} record</div>
                  )}
                  {liveResult.events.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <p className="text-[12px] text-muted-foreground/60 font-light">Nessuna attività registrata negli ultimi 7gg</p>
                    </div>
                  ) : (
                    <TimelineCanvas
                      events={[...liveResult.events]}
                      kpis={[...liveResult.kpis]}
                    />
                  )}
                </div>
              )}
              {canvas === "live-flow" && liveResult && liveResult.kind === "flow" && (
                <div className="float-panel p-6 rounded-2xl">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[13px] font-light text-foreground">{liveResult.title}</h3>
                    <button onClick={() => { setCanvas(null); setLiveResult(null); }} className="text-muted-foreground/60 hover:text-foreground text-[10px]">✕</button>
                  </div>
                  {liveResult.nodes.length <= 1 && liveResult.nodes[0]?.type === "end" ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <p className="text-[12px] text-muted-foreground/60 font-light">Nessuna campagna in corso</p>
                    </div>
                  ) : (
                    <FlowCanvas
                      nodes={[...liveResult.nodes]}
                      title={`${liveResult.meta?.count ?? 0} job totali`}
                      badge="LIVE"
                      sourceLabel={liveResult.meta?.sourceLabel}
                    />
                  )}
                </div>
              )}
              {canvas === "live-composer" && liveResult && liveResult.kind === "composer" && (
                <ComposerCanvas
                  initialTo={liveResult.initialTo}
                  initialSubject={liveResult.initialSubject}
                  initialBody={liveResult.initialBody}
                  promptHint={liveResult.promptHint}
                  onClose={() => { setCanvas(null); setLiveResult(null); }}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Dock */}
      <FloatingDock />
    </div>
  );
};

export default CommandPage;
export { CommandPage };