import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Mic, MicOff, X, Bot, Loader2, Plus, History, Trash2, Zap, MessageSquare, PanelRightOpen, PanelRightClose, Search, Users, FileText, BarChart3, Volume2 } from "lucide-react";
import AiEntity from "./AiEntity";
import VoicePresence from "./VoicePresence";
import { countActivePartners } from "@/data/partners";
import { invokeEdge } from "@/lib/api/invokeEdge";
import AIMarkdown from "./AIMarkdown";
import { useAIConversation, type ConversationMessage } from "@/hooks/useAIConversation";
import { useQuery } from "@tanstack/react-query";
import { PageErrorBoundary } from "@/components/ui/PageErrorBoundary";
import { dispatchAiAgentEffects, parseAiAgentResponse } from "@/lib/ai/agentResponse";
import { useContinuousSpeech } from "@/hooks/useContinuousSpeech";
import { AiResultsPanel, type StructuredPartner } from "@/components/operations/AiResultsPanel";
import { LiveOperationCards } from "@/components/ai/LiveOperationCards";
import { useLocation } from "react-router-dom";
import { ROUTE_OUTREACH, ROUTE_NETWORK, ROUTE_CRM, ROUTE_AGENDA } from "@/constants/routes";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { countPartnerContacts } from "@/data/partnerRelations";
import { countEmailDrafts } from "@/data/emailDrafts";
import { countBusinessCards } from "@/data/businessCards";

function useSystemStats() {
  return useQuery({
    queryKey: ["intelliflow-stats"],
    queryFn: async () => {
      const [partners, contacts, drafts, cards] = await Promise.all([
        countActivePartners().then(c => ({ count: c })),
        countPartnerContacts().then(c => ({ count: c })),
        countEmailDrafts().then(c => ({ count: c })),
        countBusinessCards().then(c => ({ count: c })),
      ]);
      return {
        partners: partners.count ?? 0,
        contacts: contacts.count ?? 0,
        drafts: drafts.count ?? 0,
        cards: cards.count ?? 0,
      };
    },
    staleTime: 60_000,
  });
}

const QUICK_PROMPTS: Record<string, string[]> = {
  default: [
    "Riepilogo del giorno",
    "Partner senza contatti",
    "Attività in scadenza",
    "Stato campagne attive",
  ],
  "/outreach": [
    "Filtra contatti italiani",
    "Seleziona tutti con priorità alta",
    "Prepara email per i contatti selezionati",
    "Deep search dei selezionati",
  ],
  "/network": [
    "Scarica tutti i partner",
    "Scarica partner USA",
    "Aggiorna profili mancanti",
    "Stato download attivi",
  ],
  "/crm": [
    "Contatti importati per origine",
    "Contatti senza email",
    "Statistiche per paese",
    "Contatti più recenti",
  ],
};

interface IntelliFlowOverlayProps {
  open: boolean;
  onClose: () => void;
  /** Cockpit contacts for AI commands */
  cockpitContacts?: Array<{ id: string; name: string; company: string; country: string; priority: number; language: string; channels: string[] }>;
  /** Callback to execute cockpit AI actions */
  onCockpitAIActions?: (actions: any[], message: string) => void;
}

export default function IntelliFlowOverlay({ open, onClose, cockpitContacts, onCockpitAIActions }: IntelliFlowOverlayProps) {
  const {
    messages, addMessages, newConversation,
    conversations, resumeConversation, deleteConversation,
  } = useAIConversation("intelliflow");

  const location = useLocation();
  const currentPage = location.pathname;
  const seg = currentPage.replace(/^\/v2/, "");
  const isCockpit = seg === "/outreach";

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showPanel, setShowPanel] = useState(true);
  const [mode, setMode] = useState<"operational" | "conversational">("operational");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: stats } = useSystemStats();

  const speech = useContinuousSpeech((text) => setInput(text));

  const isEmpty = messages.length === 0;

  // Collect structured data from messages for right panel
  const panelData = useMemo(() => {
    const allPartners: StructuredPartner[] = [];
    const allOperations: any[] = [];
    for (const msg of messages) {
      if (msg.role !== "assistant") continue;
      const parsed = parseAiAgentResponse<StructuredPartner>(msg.content);
      if (parsed.partners.length) allPartners.push(...parsed.partners);
      if (parsed.operations.length) allOperations.push(...parsed.operations);
    }
    return { partners: allPartners, operations: allOperations };
  }, [messages]);

  const hasPanelContent = panelData.partners.length > 0 || panelData.operations.length > 0;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const ts = () => new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

  const quickPrompts = QUICK_PROMPTS[currentPage] || QUICK_PROMPTS.default;

  const sendMessage = useCallback(async (text?: string) => {
    const content = (text || input).trim();
    if (!content || loading) return;

    const userMsg: ConversationMessage = { role: "user", content, timestamp: ts() };
    const prevMessages = [...messages, userMsg];
    await addMessages([userMsg]);
    setInput("");
    setLoading(true);

    const history = prevMessages.map(m => ({ role: m.role, content: m.content }));

    try {
      // Route to unified-assistant with cockpit scope if on cockpit page and in operational mode
      if (isCockpit && mode === "operational" && cockpitContacts) {
        const data = await invokeEdge<any>("unified-assistant", { body: { scope: "cockpit", command: content, contacts: cockpitContacts }, context: "IntelliFlowOverlay.cockpit_assistant" });
        if (data?.error) throw new Error(data.error);
        
        const actions = data?.actions || [];
        const message = data?.message || "Comando eseguito.";
        
        if (onCockpitAIActions && actions.length > 0) {
          onCockpitAIActions(actions, message);
        }
        
        const assistantMsg: ConversationMessage = { role: "assistant", content: message, timestamp: ts() };
        await addMessages([assistantMsg]);
      } else {
        // Standard AI assistant — route through unified-assistant
        const scope = mode === "conversational" ? "strategic" : "partner_hub";
        const body = mode === "conversational"
          ? { scope, messages: history, pageContext: currentPage, systemStats: stats }
          : { scope, messages: history, context: { currentPage } };
        const data = await invokeEdge<any>("unified-assistant", { body, context: `IntelliFlowOverlay.unified_${scope}` });
        const raw = data?.content || data?.message || "";
        dispatchAiAgentEffects(parseAiAgentResponse(raw));
        const assistantMsg: ConversationMessage = { role: "assistant", content: raw, timestamp: ts() };
        await addMessages([assistantMsg]);
      }
    } catch (e: any) {
      const errMsg: ConversationMessage = { role: "assistant", content: "⚠️ " + (e.message || "Errore di comunicazione"), timestamp: ts() };
      await addMessages([errMsg]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, messages, addMessages, mode, stats, currentPage, isCockpit, cockpitContacts, onCockpitAIActions]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  const statsLine = stats
    ? `${stats.partners.toLocaleString("it-IT")} partner · ${stats.contacts.toLocaleString("it-IT")} contatti · ${stats.drafts.toLocaleString("it-IT")} campagne · ${stats.cards.toLocaleString("it-IT")} business card`
    : "Caricamento dati…";

  const pageLabel = {
    "/outreach": "Cockpit",
    "/network": "Network",
    "/crm": "CRM",
    "/": "Dashboard",
    "/global": "Global",
    "/agenda": "Agenda",
  }[currentPage] || "Sistema";

  return (
    <PageErrorBoundary>
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[100] flex flex-col bg-background"
        >
          {/* Top bar */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-border/70 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-xs text-foreground font-medium tracking-wide">IntelliFlow · {pageLabel}</span>
              {loading && (
                <span className="text-[10px] text-primary font-mono ml-2 font-semibold">ELABORAZIONE</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Mode toggle */}
              <div className="flex items-center gap-0.5 bg-secondary/50 rounded-lg p-0.5 text-[10px]">
                <button
                  onClick={() => setMode("operational")}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all ${mode === "operational" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Zap className="w-3 h-3" /> Operativo
                </button>
                <button
                  onClick={() => setMode("conversational")}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all ${mode === "conversational" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <MessageSquare className="w-3 h-3" /> Strategico
                </button>
              </div>
              {/* Panel toggle */}
              <button
                onClick={() => setShowPanel(!showPanel)}
                className={`flex items-center gap-1.5 text-[10px] transition-colors px-2 py-1.5 rounded-lg ${showPanel ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-secondary/30"}`}
                title="Pannello operativo"
              >
                {showPanel ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">Pannello</span>
              </button>
              <button
                onClick={() => { newConversation(); setShowHistory(false); }}
                className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-lg hover:bg-secondary/30"
                title="Nuova conversazione"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Nuova</span>
              </button>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={`flex items-center gap-1.5 text-[10px] transition-colors px-2 py-1.5 rounded-lg ${showHistory ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-secondary/30"}`}
                title="Cronologia chat"
              >
                <History className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cronologia</span>
              </button>
              <span className="text-[10px] text-muted-foreground font-mono tracking-wider hidden lg:block">{statsLine}</span>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-secondary/30">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Main */}
          <div className="flex-1 flex min-h-0">
            {/* History sidebar */}
            <AnimatePresence>
              {showHistory && (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 260, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="border-r border-border/70 overflow-hidden flex-shrink-0"
                >
                  <div className="w-[260px] h-full overflow-y-auto py-3 px-2 space-y-1">
                    <p className="text-[10px] text-muted-foreground font-medium px-2 mb-2 uppercase tracking-wider">Conversazioni recenti</p>
                    {conversations.length === 0 && (
                      <p className="text-[11px] text-muted-foreground/60 px-2">Nessuna conversazione salvata</p>
                    )}
                    {conversations.map((c) => (
                      <div
                        key={c.id}
                        className="group flex items-center gap-1 rounded-lg px-2 py-2 cursor-pointer hover:bg-secondary/40 transition-colors"
                        onClick={() => { resumeConversation(c.id); setShowHistory(false); }}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-foreground/80 truncate">{c.title}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(c.updated_at).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}
                          </p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteConversation(c.id); }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Content: Chat + Optional Panel */}
            <ResizablePanelGroup direction="horizontal" className="flex-1">
              {/* Chat area */}
              <ResizablePanel defaultSize={showPanel && hasPanelContent ? 55 : 100} minSize={40}>
                <div className="flex flex-col h-full min-h-0">
                  {isEmpty ? (
                    <div className="flex-1 flex flex-col items-center justify-center px-8">
                      <div className="mb-8"><AiEntity size="lg" /></div>
                      <h2 className="text-2xl font-semibold tracking-tight text-foreground mb-3">Cosa vuoi ottenere?</h2>
                      <p className="text-sm text-muted-foreground mb-4 text-center max-w-sm">{statsLine}</p>
                      <div className="flex items-center gap-1.5 mb-8 text-[10px] text-muted-foreground">
                        <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">{pageLabel}</span>
                        <span>·</span>
                        <span>Comandi contestuali attivi</span>
                      </div>
                      <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                        {quickPrompts.map((p) => (
                          <button
                            key={p}
                            onClick={() => sendMessage(p)}
                            className="text-xs px-4 py-2.5 rounded-full border border-border bg-card/80 text-foreground/80 hover:text-foreground hover:bg-card transition-colors font-medium"
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto px-8 py-6">
                      <div className="max-w-2xl mx-auto space-y-4">
                        {messages.map((msg, i) => (
                          <div key={i} className={`flex items-start gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                            {msg.role === "assistant" && (
                              <div className="flex-shrink-0 mt-1"><AiEntity size="sm" pulse={false} /></div>
                            )}
                            <div
                              className={`max-w-[85%] px-5 py-4 rounded-2xl border border-border/70 ${
                                msg.role === "user" ? "rounded-br-lg bg-secondary/60" : "rounded-bl-lg bg-card/80"
                              }`}
                            >
                              {msg.role === "assistant" && (
                                <div className="flex items-center gap-1.5 mb-2 text-[10px] text-primary font-mono tracking-[0.2em] uppercase font-semibold">
                                  <Bot className="w-3 h-3" />Segretario Operativo
                                  <button
                                    onClick={() => {
                                      const text = msg.content.slice(0, 3000);
                                      fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`, {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
                                        body: JSON.stringify({ text, voiceId: "FGY2WhTYpPnrIDTdsKH5" }),
                                      }).then(r => r.ok ? r.blob() : null).then(b => b && new Audio(URL.createObjectURL(b)).play()).catch(() => {});
                                    }}
                                    className="ml-auto text-muted-foreground hover:text-foreground transition-colors p-0.5"
                                    title="Ascolta risposta"
                                  >
                                    <Volume2 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                              <div className="ai-prose max-w-none">
                                {msg.role === "assistant" ? (() => {
                                  const parsed = parseAiAgentResponse<StructuredPartner>(msg.content);
                                  return (
                                    <>
                                      <AIMarkdown content={parsed.text} />
                                      {parsed.operations.length > 0 && <LiveOperationCards operations={parsed.operations} />}
                                    </>
                                  );
                                })() : <AIMarkdown content={msg.content} />}
                              </div>
                              {msg.timestamp && <span className="text-[10px] text-muted-foreground mt-2 block">{msg.timestamp}</span>}
                            </div>
                          </div>
                        ))}
                        {loading && (
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-1"><AiEntity size="sm" /></div>
                            <div className="flex items-center gap-2 px-5 py-4">
                              <Loader2 className="w-4 h-4 text-primary animate-spin" />
                              <span className="text-xs text-muted-foreground">Elaborazione in corso…</span>
                            </div>
                          </div>
                        )}
                        <div ref={chatEndRef} />
                      </div>
                    </div>
                  )}

                  <VoicePresence active={speech.listening} listening={speech.listening} speaking={false} />

                  {/* Input bar */}
                  <div className="px-8 pb-8 pt-3 flex-shrink-0">
                    <div className="max-w-2xl mx-auto">
                      <motion.div
                        animate={{
                          boxShadow: inputFocused
                            ? "0 0 0 2px hsl(var(--primary) / 0.2), 0 4px 24px hsl(var(--primary) / 0.08)"
                            : "0 0 0 1px hsl(var(--border))"
                        }}
                        transition={{ duration: 0.3 }}
                        className="flex items-center gap-3 rounded-2xl px-4 py-3 bg-card border border-border"
                      >
                        <button
                          onClick={speech.toggle}
                          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all flex-shrink-0 ${
                            speech.listening
                              ? "bg-destructive/20 text-destructive ring-2 ring-destructive/40"
                              : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                          }`}
                        >
                          {speech.listening ? <MicOff className="w-5 h-5 animate-pulse" /> : <Mic className="w-5 h-5" />}
                        </button>
                        <input
                          ref={inputRef}
                          type="text"
                          placeholder={
                            speech.listening
                              ? "🎙 Sto ascoltando…"
                              : isCockpit && mode === "operational"
                              ? "Comanda il cockpit — filtra, seleziona, deep search..."
                              : mode === "conversational"
                              ? "Discutiamo strategia…"
                              : "Scrivi un obiettivo…"
                          }
                          value={speech.listening ? (input + (speech.interimText ? ` ${speech.interimText}` : "")) : input}
                          onChange={(e) => setInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                          onFocus={() => setInputFocused(true)}
                          onBlur={() => setInputFocused(false)}
                          disabled={loading}
                          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground text-foreground"
                        />
                        <button
                          onClick={() => sendMessage()}
                          disabled={!input.trim() || loading}
                          className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/15 text-primary hover:bg-primary/25 transition-all disabled:opacity-30 flex-shrink-0"
                        >
                          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </button>
                      </motion.div>
                    </div>
                  </div>
                </div>
              </ResizablePanel>

              {/* Right operative panel */}
              {showPanel && hasPanelContent && (
                <>
                  <ResizableHandle withHandle />
                  <ResizablePanel defaultSize={45} minSize={25} maxSize={60}>
                    <div className="h-full flex flex-col border-l border-border/50 bg-card/30">
                      <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-primary" />
                        <span className="text-xs font-semibold text-foreground">Pannello Operativo</span>
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {panelData.partners.length > 0 && `${panelData.partners.length} risultati`}
                        </span>
                      </div>
                      <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {panelData.operations.length > 0 && (
                          <div>
                            <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                              <FileText className="w-3 h-3" /> Operazioni
                            </h4>
                            <LiveOperationCards operations={panelData.operations} />
                          </div>
                        )}
                        {panelData.partners.length > 0 && (
                          <div>
                            <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                              <Users className="w-3 h-3" /> Partner trovati
                            </h4>
                            <AiResultsPanel partners={panelData.partners} />
                          </div>
                        )}
                      </div>
                    </div>
                  </ResizablePanel>
                </>
              )}
            </ResizablePanelGroup>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
    </PageErrorBoundary>
  );
}
