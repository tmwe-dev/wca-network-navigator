import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Mic, MicOff, Wand2, Volume2, VolumeX, X } from "lucide-react";
import AiEntity from "./AiEntity";
import ApprovalPanel from "./ApprovalPanel";
import ExecutionFlow, { type ExecutionStep } from "./ExecutionFlow";
import ToolActivationBar from "./ToolActivationBar";
import VoicePresence from "./VoicePresence";
import { TableCanvas, CampaignCanvas, ReportCanvas, ResultCanvas } from "./CanvasViews";

const ease = [0.2, 0.8, 0.2, 1] as const;

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  agentName?: string;
  thinking?: boolean;
  meta?: string;
  governance?: string;
}

type CanvasType = "table" | "campaign" | "report" | "result" | null;
type FlowPhase = "idle" | "thinking" | "proposal" | "approval" | "executing" | "done";
type ToolPhase = "activating" | "active" | "done";

const tableData = [
  { name: "TechBridge Japan", sector: "Technology", revenue: "€412k", days: "98", churn: 91 },
  { name: "Meridian Asia Pacific", sector: "Consulting", revenue: "€234k", days: "112", churn: 89 },
  { name: "SteelForge Srl", sector: "Manufacturing", revenue: "€187k", days: "105", churn: 85 },
  { name: "NovaPharma Group", sector: "Healthcare", revenue: "€156k", days: "93", churn: 82 },
  { name: "Apex Financial", sector: "Finance", revenue: "€298k", days: "88", churn: 76 },
  { name: "Orion Logistics", sector: "Logistics", revenue: "€143k", days: "120", churn: 71 },
];

const quickPrompts = [
  "Importa 300 contatti e uniscili ai partner WCA",
  "Campagna per 50 lead da import + deep search",
  "Report executive partner Asia cross-source",
  "10 bozze email personalizzate per partner Asia",
  "Leggi ad alta voce il riepilogo prima della conferma",
  "Lancia invio batch con approvazione step-by-step",
  "Salva questo flusso come template operativo",
];

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
    assistantMessages: [{ content: "Ho ricevuto il file con 300 contatti. Sto usando la pipeline di import già operativa:\n\n**Parse Contact File** → 300 record estratti\n**Deduplicate & Merge** → 287 profili unici\n**Run Deep Search** → 42 profili arricchiti\n**Match Partner Network** → 23 contatti collegati a partner WCA\n\nProfili pronti per l'inserimento.", agentName: "Orchestratore", meta: "contact-ingestion · dedup-engine · deep-search · partner-mgmt · 5 moduli · 2.3s", governance: "Ruolo: Admin · Permesso: Import & Write · Policy: max 500 record/batch" }],
    canvas: "table",
    approval: { title: "Importare 287 contatti nel CRM?", description: "287 profili unici dopo deduplicazione. 23 collegati a partner WCA. 42 arricchiti con Deep Search.", details: [{ label: "Record originali", value: "300" }, { label: "Dopo dedup", value: "287 unici" }, { label: "Match WCA", value: "23" }, { label: "Deep Search", value: "42 arricchiti" }], governance: { role: "Admin", permission: "Import & Write", policy: "Max 500 record/batch" } },
    executionSteps: [{ label: "Parse Contact File → 300 record", status: "done", detail: "300/300 ✓" }, { label: "Deduplicate & Merge → 287 unici", status: "done", detail: "13 rimossi" }, { label: "Deep Search enrichment", status: "done", detail: "42 arricchiti" }, { label: "Update CRM Records", status: "running", detail: "189/287" }, { label: "Audit Action → log importazione", status: "pending" }],
    resultCanvas: "result",
  },
  campaign: {
    key: "campaign",
    assistantMessages: [{ content: "Ho costruito il target usando 3 fonti dati:\n\n**Search Contacts** → 32 lead da Imported Contacts (inattivi >90gg)\n**Search Partners** → 11 contatti dal network WCA\n**Deduplicate & Merge** → 50 profili unici\n**Create Email Draft** → 50 bozze generate con template Re-engagement Q1", agentName: "Communication", meta: "contact-db · partner-mgmt · dedup-engine · email-draft · 6 moduli · 3.2s", governance: "Ruolo: Admin · Permesso: Send Email Batch · Policy: max 100 email/batch" }],
    canvas: "campaign",
    approval: { title: "Avviare invio batch di 50 email?", description: "50 email personalizzate da 3 fonti unificate.", details: [{ label: "Fonti", value: "Import · WCA · Cards" }, { label: "Profili target", value: "50 unici" }, { label: "Wave", value: "3 (17 · 17 · 16)" }], governance: { role: "Admin", permission: "Send Email Batch", policy: "Max 100 email/batch" } },
    executionSteps: [{ label: "Validazione contatti", status: "done", detail: "50/50 ✓" }, { label: "Generazione bozze", status: "done", detail: "50 email" }, { label: "Governance check", status: "done", detail: "Conforme" }, { label: "Invio wave 1", status: "running", detail: "12/17" }, { label: "Invio wave 2", status: "pending" }, { label: "Invio wave 3", status: "pending" }],
    resultCanvas: "result",
  },
  report: {
    key: "report",
    assistantMessages: [{ content: "Ho generato il report usando 4 sorgenti dati:\n\n**Search Partners** → 23 partner Asia Pacific\n**Read Company Report** → 12 report analizzati\n**Analyze Data** → Scoring e trend analysis\n**Generate Executive Report** → Documento formattato per presentazione board", agentName: "Data Analyst", meta: "partner-mgmt · workspace-docs · analytics · reporting · 4 moduli · 2.8s" }],
    canvas: "report",
  },
  email: {
    key: "email",
    assistantMessages: [{ content: "Ho generato 10 bozze usando il motore email drafting:\n\n**Search Contacts** → 10 contatti selezionati\n**Read Company Report** → Contesto aziendale\n**Create Email Draft** → 10 bozze con personalizzazione cross-source\n\nLe bozze sono nel workspace, pronte per revisione.", agentName: "Communication", meta: "contact-db · workspace-docs · email-draft · 5 moduli · 1.9s" }],
    canvas: null,
  },
  voice: {
    key: "voice",
    autoVoice: true,
    assistantMessages: [{ content: "Preparo la lettura vocale:\n\n**Load Context** → Caricamento ultimo riepilogo\n**Read Aloud** → Attivazione voice con ElevenLabs TTS\n\nIl sistema leggerà il riepilogo. Puoi interrompere in qualsiasi momento.", agentName: "Voice", meta: "conversation-memory · voice-interaction · tts-engine · 3 moduli" }],
    canvas: null,
  },
  batch: {
    key: "batch",
    assistantMessages: [{ content: "Preparo l'invio batch con approvazione step-by-step:\n\n**Search Contacts** → 120 contatti da 3 fonti\n**Validate & Deduplicate** → 118 profili validi\n**Create Email Draft** → 118 bozze generate\n**Governance Check** → Verifica completata\n\nInvio diviso in 4 wave con approvazione intermedia.", agentName: "Automation", meta: "6 tool · 2.9s", governance: "Ruolo: Admin · Permesso: Send Batch · Policy: max 50/wave" }],
    canvas: null,
    approval: { title: "Avviare invio batch di 118 email in 4 wave?", description: "Ogni wave richiede approvazione. Audit trail completo.", details: [{ label: "Contatti validati", value: "118 / 120" }, { label: "Wave", value: "4 (30·30·30·28)" }, { label: "Governance", value: "✓ Conforme" }], governance: { role: "Admin", permission: "Send Batch", policy: "Max 50 email/wave" } },
    executionSteps: [{ label: "Validazione contatti", status: "done", detail: "118/118 ✓" }, { label: "Wave 1", status: "done", detail: "30/30 ✓" }, { label: "Wave 2", status: "running", detail: "18/30" }, { label: "Wave 3", status: "pending" }, { label: "Wave 4", status: "pending" }],
    resultCanvas: "result",
  },
  template: {
    key: "template",
    assistantMessages: [{ content: "Analizzo il flusso per creare un template operativo:\n\n**Save Template** → Flusso serializzato con step, tool e parametri\n**Audit Action** → Creazione registrata\n\nDisponibile nella Template Library.", agentName: "Orchestratore", meta: "Save Template · Audit Action · 2 tool · 0.3s" }],
    canvas: null,
    resultCanvas: "result",
    approval: { title: "Salvare questo flusso come template?", description: "Includerà tutti gli step e i tool del flusso corrente.", details: [{ label: "Step", value: "6" }, { label: "Tool", value: "4" }], governance: { role: "Admin", permission: "Template Management", policy: "Versioning attivo" } },
    executionSteps: [{ label: "Analisi flusso", status: "done", detail: "6 step" }, { label: "Serializzazione", status: "done" }, { label: "Save Template", status: "running" }, { label: "Audit Action", status: "pending" }],
  },
  churn: {
    key: "churn",
    assistantMessages: [{ content: "Ho incrociato 3 sorgenti dati:\n\n**Search Partners** → 234 partner dal network WCA\n**Search Contacts** → 12.847 contatti dal database unificato\n**Run ML Scoring** → Churn scoring su 34 account\n**Generate Report** → 6 account critici (score ≥85)", agentName: "Orchestratore", meta: "partner-mgmt · contact-db · deep-search · analytics · 5 moduli · 1.7s" }],
    canvas: "table",
  },
};

function detectScenario(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("template") || lower.includes("salva questo flusso")) return "template";
  if (lower.includes("batch") || lower.includes("invio batch")) return "batch";
  if (lower.includes("importa") || lower.includes("uniscili")) return "import";
  if (lower.includes("campagna") || lower.includes("lead")) return "campaign";
  if (lower.includes("report") || lower.includes("asia")) return "report";
  if (lower.includes("bozze") || lower.includes("email") || lower.includes("draft")) return "email";
  if (lower.includes("leggi") || lower.includes("voce") || lower.includes("alta voce")) return "voice";
  return "churn";
}

interface IntelliFlowOverlayProps {
  open: boolean;
  onClose: () => void;
}

export default function IntelliFlowOverlay({ open, onClose }: IntelliFlowOverlayProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [micActive, setMicActive] = useState(false);
  const [voiceSpeaking, setVoiceSpeaking] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [canvas, setCanvas] = useState<CanvasType>(null);
  const [flowPhase, setFlowPhase] = useState<FlowPhase>("idle");
  const [activeScenario, setActiveScenario] = useState<Scenario | null>(null);
  const [activeScenarioKey, setActiveScenarioKey] = useState<string | null>(null);
  const [showTools, setShowTools] = useState(false);
  const [toolPhase, setToolPhase] = useState<ToolPhase>("active");
  const [chainHighlight, setChainHighlight] = useState<number | undefined>(undefined);
  const [execProgress, setExecProgress] = useState(0);
  const [execSteps, setExecSteps] = useState<ExecutionStep[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const isEmpty = messages.length === 0;

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const ts = () => new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

  const addMessage = useCallback((msg: Omit<Message, "id">) => {
    setMessages((prev) => [...prev, { ...msg, id: Date.now() + Math.random() }]);
  }, []);

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
      setChainHighlight(prev => { if (prev === undefined || prev >= 2) return prev; return prev + 1; });
    }, 700);

    setTimeout(() => {
      clearInterval(chainInterval);
      setToolPhase("active");
      setChainHighlight(3);
      setMessages(prev => prev.filter(m => !m.thinking));
      scenario.assistantMessages.forEach(am => {
        addMessage({ role: "assistant", content: am.content, timestamp: ts(), agentName: am.agentName, meta: am.meta, governance: am.governance });
      });
      setCanvas(scenario.canvas);
      setFlowPhase(scenario.approval ? "proposal" : "done");
      if (scenario.autoVoice) setTimeout(() => setVoiceSpeaking(true), 800);
    }, 2200);
  }, [addMessage]);

  const handleApprove = useCallback(() => {
    if (!activeScenario) return;
    setFlowPhase("executing");
    setCanvas(null);
    setChainHighlight(5);
    addMessage({ role: "assistant", content: "Esecuzione avviata. Automation Agent coordina gli step. Governance Agent monitora ogni azione.", timestamp: ts(), agentName: "Automation" });

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
            addMessage({ role: "assistant", content: "Esecuzione completata. Audit log aggiornato.\n\nVuoi salvare questo flusso come template operativo?", timestamp: ts(), agentName: "Orchestratore" });
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
    addMessage({ role: "assistant", content: "Operazione annullata. Nessuna azione eseguita.", timestamp: ts(), agentName: "Orchestratore" });
  }, [addMessage]);

  const sendMessage = (text?: string) => {
    const content = text || input.trim();
    if (!content) return;
    addMessage({ role: "user", content, timestamp: ts() });
    setInput("");
    setCanvas(null);
    setFlowPhase("idle");
    setShowTools(false);
    setVoiceSpeaking(false);
    setChainHighlight(undefined);
    runFlow(detectScenario(content));
  };

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[100] flex flex-col"
          style={{
            background: "hsl(var(--background) / 0.97)",
            backdropFilter: "blur(40px) saturate(1.1)",
          }}
        >
          {/* Ambient glow */}
          <div className="fixed inset-0 pointer-events-none z-0">
            <motion.div
              className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full"
              style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.012), transparent 70%)" }}
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>

          {/* Top bar */}
          <div className="flex items-center justify-between px-6 py-3 relative z-10 flex-shrink-0">
            <div className="flex items-center gap-3">
              <motion.div className="w-1.5 h-1.5 rounded-full bg-primary/40" animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ duration: 3, repeat: Infinity }} />
              <span className="text-[11px] text-muted-foreground/30 font-light tracking-wide">IntelliFlow · Sessione attiva</span>
              {flowPhase !== "idle" && flowPhase !== "done" && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[9px] text-primary/30 font-mono ml-2">
                  {flowPhase === "thinking" ? "ELABORAZIONE" : flowPhase === "proposal" ? "PROPOSTA" : flowPhase === "approval" ? "IN ATTESA" : "ESECUZIONE"}
                </motion.span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[8px] text-muted-foreground/12 font-mono tracking-wider">14 fonti · 12.8k contatti · 234 partner · 7 agenti</span>
              <button onClick={onClose} className="text-muted-foreground/30 hover:text-foreground/60 transition-colors duration-300 p-1.5 rounded-lg hover:bg-secondary/10">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Main */}
          <div className="flex-1 flex overflow-hidden relative z-10">
            {/* Conversation */}
            <div className={`flex-1 flex flex-col transition-all duration-700 ease-out ${canvas ? "max-w-[50%]" : ""}`}>
              {isEmpty ? (
                <div className="flex-1 flex flex-col items-center justify-center px-8">
                  <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.5, ease }} className="mb-10">
                    <AiEntity size="lg" />
                  </motion.div>
                  <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, ease }} className="text-2xl font-extralight tracking-tight text-foreground/70 mb-2">
                    Cosa vuoi ottenere?
                  </motion.h2>
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="text-[13px] text-muted-foreground/30 font-light mb-10 text-center max-w-sm">
                    14 sorgenti unificate · 12.847 contatti · 234 partner WCA
                  </motion.p>
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }} className="flex flex-col items-center gap-2">
                    {quickPrompts.map((p, i) => (
                      <motion.button key={p} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 + i * 0.1, ease }} onClick={() => sendMessage(p)} whileHover={{ x: 4 }} className="text-[12px] px-4 py-2.5 rounded-2xl text-muted-foreground/25 hover:text-muted-foreground/50 hover:bg-secondary/[0.04] transition-all duration-700 text-left">
                        → {p}
                      </motion.button>
                    ))}
                  </motion.div>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto px-8 py-6">
                  <div className="max-w-xl mx-auto space-y-6">
                    <ToolActivationBar scenarioKey={activeScenarioKey} visible={showTools && flowPhase !== "idle"} phase={toolPhase} chainHighlight={chainHighlight} />

                    {messages.map((msg) => (
                      <AnimatePresence key={msg.id}>
                        {msg.thinking ? (
                          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-1"><AiEntity size="sm" /></div>
                            <div className="flex items-center gap-2 px-5 py-4">
                              {[0, 1, 2].map(dot => (
                                <motion.div key={dot} className="w-1.5 h-1.5 rounded-full bg-primary/30" animate={{ opacity: [0.2, 0.7, 0.2], scale: [0.8, 1.1, 0.8] }} transition={{ duration: 1.2, repeat: Infinity, delay: dot * 0.2 }} />
                              ))}
                              <span className="text-[11px] text-muted-foreground/25 ml-2 font-light">Attivo tool operativi...</span>
                            </div>
                          </motion.div>
                        ) : (
                          <motion.div initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.6, ease }} className={`flex items-start gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                            {msg.role === "assistant" && <div className="flex-shrink-0 mt-1"><AiEntity size="sm" pulse={false} /></div>}
                            <motion.div
                              className={`max-w-[85%] relative ${msg.role === "user" ? "px-5 py-4 rounded-2xl rounded-br-lg" : "px-5 py-4 rounded-2xl rounded-bl-lg"}`}
                              style={{
                                background: msg.role === "assistant" ? "hsl(var(--background) / 0.7)" : "hsl(var(--secondary) / 0.4)",
                                border: `1px solid hsl(var(--foreground) / ${msg.role === "assistant" ? "0.05" : "0.03"})`,
                                backdropFilter: "blur(40px)",
                                boxShadow: msg.role === "assistant" ? "0 0 60px hsl(var(--primary) / 0.03), 0 20px 50px -20px hsl(0 0% 0% / 0.4)" : "none",
                              }}
                            >
                              {msg.agentName && (
                                <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }} className="text-[9px] text-primary/40 font-mono mb-2.5 tracking-[0.2em] uppercase">{msg.agentName}</motion.div>
                              )}
                              <div className="text-[14px] leading-[1.7] whitespace-pre-line font-light text-foreground/85">
                                {msg.content.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
                                  part.startsWith("**") && part.endsWith("**")
                                    ? <span key={i} className="text-primary/50 font-mono text-[12px]">{part.slice(2, -2)}</span>
                                    : <span key={i}>{part}</span>
                                )}
                              </div>
                              {msg.meta && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="flex items-center gap-2 mt-3 pt-2 border-t border-border/[0.04]">
                                  <Wand2 className="w-2.5 h-2.5 text-primary/15" />
                                  <span className="text-[9px] text-muted-foreground/20 font-light font-mono">{msg.meta}</span>
                                </motion.div>
                              )}
                              {msg.governance && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="flex items-center gap-2 mt-1.5">
                                  <div className="w-1 h-1 rounded-full bg-success/30" />
                                  <span className="text-[8px] text-muted-foreground/15 font-mono">{msg.governance}</span>
                                </motion.div>
                              )}
                              <span className="text-[9px] text-muted-foreground/15 mt-2 block">{msg.timestamp}</span>
                            </motion.div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    ))}

                    {activeScenario?.approval && (flowPhase === "proposal" || flowPhase === "approval") && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                        <ApprovalPanel visible title={activeScenario.approval.title} description={activeScenario.approval.description} details={activeScenario.approval.details} governance={activeScenario.approval.governance} onApprove={handleApprove} onModify={() => {}} onCancel={handleCancel} />
                      </motion.div>
                    )}

                    <ExecutionFlow visible={flowPhase === "executing"} steps={execSteps} progress={execProgress} />
                    <div ref={chatEndRef} />
                  </div>
                </div>
              )}

              <VoicePresence active={micActive || voiceSpeaking} listening={micActive && !voiceSpeaking} speaking={voiceSpeaking} />

              {/* Input */}
              <div className="px-8 pb-8 pt-2">
                <div className="max-w-xl mx-auto">
                  <motion.div
                    animate={{ boxShadow: inputFocused ? "0 0 0 1px hsl(var(--primary) / 0.08), 0 0 60px hsl(var(--primary) / 0.03)" : "0 0 0 0.5px hsl(0 0% 0% / 0.15)" }}
                    transition={{ duration: 0.6 }}
                    className="flex items-center gap-3 rounded-2xl px-4 py-3"
                    style={{ background: "hsl(var(--background) / 0.6)", backdropFilter: "blur(40px)", border: "1px solid hsl(var(--foreground) / 0.03)" }}
                  >
                    <motion.button onClick={() => { setMicActive(!micActive); setVoiceSpeaking(false); }} whileTap={{ scale: 0.9 }} className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-500 flex-shrink-0 ${micActive ? "bg-primary/10 text-primary/60" : "text-muted-foreground/15 hover:text-muted-foreground/30"}`}>
                      {micActive ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </motion.button>
                    <input type="text" placeholder="Scrivi un obiettivo..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMessage()} onFocus={() => setInputFocused(true)} onBlur={() => setInputFocused(false)} className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground/20 font-light text-foreground/90" />
                    <motion.button onClick={() => setVoiceSpeaking(!voiceSpeaking)} whileTap={{ scale: 0.9 }} className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-500 flex-shrink-0 ${voiceSpeaking ? "bg-accent/10 text-accent/60" : "text-muted-foreground/10 hover:text-muted-foreground/25"}`}>
                      {voiceSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </motion.button>
                    <motion.button onClick={() => sendMessage()} disabled={!input.trim()} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.9 }} className="w-9 h-9 rounded-xl flex items-center justify-center bg-primary/8 text-primary/40 hover:bg-primary/12 hover:text-primary/70 transition-all duration-500 disabled:opacity-10">
                      <Send className="w-3.5 h-3.5" />
                    </motion.button>
                  </motion.div>
                </div>
              </div>
            </div>

            {/* Canvas */}
            <AnimatePresence>
              {canvas && (
                <motion.div initial={{ opacity: 0, x: 60, scale: 0.95, filter: "blur(10px)" }} animate={{ opacity: 1, x: 0, scale: 1, filter: "blur(0px)" }} exit={{ opacity: 0, x: 60, scale: 0.95, filter: "blur(10px)" }} transition={{ duration: 0.7, ease }} className="w-[50%] p-4 overflow-y-auto">
                  {canvas === "table" && <TableCanvas data={tableData} onClose={() => setCanvas(null)} />}
                  {canvas === "campaign" && <CampaignCanvas onClose={() => setCanvas(null)} />}
                  {canvas === "report" && <ReportCanvas onClose={() => setCanvas(null)} />}
                  {canvas === "result" && <ResultCanvas onClose={() => setCanvas(null)} scenarioKey={activeScenarioKey || undefined} />}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
