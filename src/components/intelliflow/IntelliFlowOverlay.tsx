import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Mic, MicOff, X, Bot, Loader2 } from "lucide-react";
import AiEntity from "./AiEntity";
import VoicePresence from "./VoicePresence";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";

/* ─── Types ─── */
interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

/* ─── Real stats hook ─── */
function useSystemStats() {
  return useQuery({
    queryKey: ["intelliflow-stats"],
    queryFn: async () => {
      const [partners, contacts, drafts, cards] = await Promise.all([
        supabase.from("partners").select("*", { count: "exact", head: true }),
        supabase.from("partner_contacts").select("*", { count: "exact", head: true }),
        supabase.from("email_drafts").select("*", { count: "exact", head: true }),
        supabase.from("business_cards").select("*", { count: "exact", head: true }),
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

const QUICK_PROMPTS = [
  "Riepilogo del giorno",
  "Partner senza contatti",
  "Attività in scadenza",
  "Stato campagne attive",
  "Cerca partner in Asia",
  "Genera report executive",
];

/* ─── Component ─── */
interface IntelliFlowOverlayProps {
  open: boolean;
  onClose: () => void;
}

export default function IntelliFlowOverlay({ open, onClose }: IntelliFlowOverlayProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: stats } = useSystemStats();

  const isEmpty = messages.length === 0;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Web Speech API
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.lang = "it-IT";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (e: any) => {
      const text = e.results[0][0].transcript;
      setInput(text);
      setMicActive(false);
    };
    recognition.onerror = () => setMicActive(false);
    recognition.onend = () => setMicActive(false);
    recognitionRef.current = recognition;
  }, []);

  const toggleMic = useCallback(() => {
    if (!recognitionRef.current) return;
    if (micActive) {
      recognitionRef.current.stop();
      setMicActive(false);
    } else {
      recognitionRef.current.start();
      setMicActive(true);
    }
  }, [micActive]);

  const ts = () => new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

  const sendMessage = useCallback(async (text?: string) => {
    const content = (text || input).trim();
    if (!content || loading) return;

    const userMsg: Message = { id: Date.now(), role: "user", content, timestamp: ts() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));

    try {
      const { data, error } = await supabase.functions.invoke("ai-assistant", {
        body: { messages: history },
      });
      if (error) throw error;
      const raw = data?.content || data?.message || "";
      setMessages(prev => [...prev, { id: Date.now() + 1, role: "assistant", content: raw, timestamp: ts() }]);
    } catch (e: any) {
      setMessages(prev => [...prev, { id: Date.now() + 1, role: "assistant", content: "⚠️ " + (e.message || "Errore di comunicazione"), timestamp: ts() }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, messages]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  const statsLine = stats
    ? `${stats.partners.toLocaleString("it-IT")} partner · ${stats.contacts.toLocaleString("it-IT")} contatti · ${stats.drafts.toLocaleString("it-IT")} campagne · ${stats.cards.toLocaleString("it-IT")} business card`
    : "Caricamento dati…";

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
          {/* Top bar */}
          <div className="flex items-center justify-between px-6 py-3 relative z-10 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
              <span className="text-[11px] text-muted-foreground font-light tracking-wide">IntelliFlow · Sessione attiva</span>
              {loading && (
                <span className="text-[9px] text-primary/70 font-mono ml-2">ELABORAZIONE</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[9px] text-muted-foreground/50 font-mono tracking-wider">{statsLine}</span>
              <button onClick={onClose} className="text-muted-foreground/60 hover:text-foreground/80 transition-colors duration-300 p-1.5 rounded-lg hover:bg-secondary/20">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Main */}
          <div className="flex-1 flex flex-col overflow-hidden relative z-10">
            {/* Conversation */}
            {isEmpty ? (
              <div className="flex-1 flex flex-col items-center justify-center px-8">
                <div className="mb-8">
                  <AiEntity size="lg" />
                </div>
                <h2 className="text-2xl font-extralight tracking-tight text-foreground/80 mb-2">
                  Cosa vuoi ottenere?
                </h2>
                <p className="text-[13px] text-muted-foreground/60 font-light mb-10 text-center max-w-sm">
                  {statsLine}
                </p>
                <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                  {QUICK_PROMPTS.map((p) => (
                    <button
                      key={p}
                      onClick={() => sendMessage(p)}
                      className="text-[12px] px-4 py-2 rounded-full border border-border/50 text-muted-foreground/70 hover:text-foreground hover:bg-secondary/15 transition-colors"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto px-8 py-6">
                <div className="max-w-2xl mx-auto space-y-4">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex items-start gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
                    >
                      {msg.role === "assistant" && (
                        <div className="flex-shrink-0 mt-1"><AiEntity size="sm" pulse={false} /></div>
                      )}
                      <div
                        className={`max-w-[85%] px-5 py-4 rounded-2xl ${msg.role === "user" ? "rounded-br-lg" : "rounded-bl-lg"}`}
                        style={{
                          background: msg.role === "assistant" ? "hsl(var(--background) / 0.7)" : "hsl(var(--secondary) / 0.4)",
                          border: `1px solid hsl(var(--foreground) / ${msg.role === "assistant" ? "0.08" : "0.06"})`,
                          backdropFilter: "blur(40px)",
                        }}
                      >
                        {msg.role === "assistant" && (
                          <div className="flex items-center gap-1.5 mb-2 text-[9px] text-primary/70 font-mono tracking-[0.2em] uppercase">
                            <Bot className="w-3 h-3" />
                            Segretario Operativo
                          </div>
                        )}
                        <div className="text-[14px] leading-[1.7] font-light text-foreground/90 prose prose-sm prose-p:my-1 prose-li:my-0 max-w-none">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                        <span className="text-[9px] text-muted-foreground/40 mt-2 block">{msg.timestamp}</span>
                      </div>
                    </div>
                  ))}

                  {loading && (
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-1"><AiEntity size="sm" /></div>
                      <div className="flex items-center gap-2 px-5 py-4">
                        <Loader2 className="w-4 h-4 text-primary/50 animate-spin" />
                        <span className="text-[11px] text-muted-foreground/60 font-light">Elaborazione in corso…</span>
                      </div>
                    </div>
                  )}

                  <div ref={chatEndRef} />
                </div>
              </div>
            )}

            {/* Voice presence */}
            <VoicePresence active={micActive} listening={micActive} speaking={false} />

            {/* Input */}
            <div className="px-8 pb-8 pt-2 flex-shrink-0">
              <div className="max-w-2xl mx-auto">
                <motion.div
                  animate={{ boxShadow: inputFocused ? "0 0 0 1px hsl(var(--primary) / 0.08), 0 0 60px hsl(var(--primary) / 0.03)" : "0 0 0 0.5px hsl(0 0% 0% / 0.15)" }}
                  transition={{ duration: 0.6 }}
                  className="flex items-center gap-3 rounded-2xl px-4 py-3"
                  style={{ background: "hsl(var(--background) / 0.6)", backdropFilter: "blur(40px)", border: "1px solid hsl(var(--foreground) / 0.08)" }}
                >
                  <button
                    onClick={toggleMic}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 flex-shrink-0 ${micActive ? "bg-destructive/15 text-destructive ring-2 ring-destructive/30" : "text-muted-foreground/50 hover:text-muted-foreground/70"}`}
                  >
                    {micActive ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Scrivi un obiettivo…"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                    onFocus={() => setInputFocused(true)}
                    onBlur={() => setInputFocused(false)}
                    disabled={loading}
                    className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground/50 font-light text-foreground/90"
                  />
                  <button
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || loading}
                    className="w-9 h-9 rounded-xl flex items-center justify-center bg-primary/12 text-primary/60 hover:bg-primary/20 hover:text-primary/80 transition-all duration-300 disabled:opacity-20 flex-shrink-0"
                  >
                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  </button>
                </motion.div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
