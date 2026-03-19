import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Mic, MicOff, X, Bot, Loader2 } from "lucide-react";
import AiEntity from "./AiEntity";
import VoicePresence from "./VoicePresence";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

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

  return (
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
              <span className="text-xs text-foreground font-medium tracking-wide">IntelliFlow · Sessione attiva</span>
              {loading && (
                <span className="text-[10px] text-primary font-mono ml-2 font-semibold">ELABORAZIONE</span>
              )}
            </div>
            <div className="flex items-center gap-4">
              <span className="text-[10px] text-muted-foreground font-mono tracking-wider">{statsLine}</span>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-secondary/30">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Main */}
          <div className="flex-1 flex flex-col min-h-0">
            {isEmpty ? (
              <div className="flex-1 flex flex-col items-center justify-center px-8">
                <div className="mb-8">
                  <AiEntity size="lg" />
                </div>
                <h2 className="text-2xl font-semibold tracking-tight text-foreground mb-3">
                  Cosa vuoi ottenere?
                </h2>
                <p className="text-sm text-muted-foreground mb-10 text-center max-w-sm">
                  {statsLine}
                </p>
                <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                  {QUICK_PROMPTS.map((p) => (
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
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex items-start gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
                    >
                      {msg.role === "assistant" && (
                        <div className="flex-shrink-0 mt-1"><AiEntity size="sm" pulse={false} /></div>
                      )}
                      <div
                        className={`max-w-[85%] px-5 py-4 rounded-2xl border border-border/70 ${
                          msg.role === "user"
                            ? "rounded-br-lg bg-secondary/60"
                            : "rounded-bl-lg bg-card/80"
                        }`}
                      >
                        {msg.role === "assistant" && (
                          <div className="flex items-center gap-1.5 mb-2 text-[10px] text-primary font-mono tracking-[0.2em] uppercase font-semibold">
                            <Bot className="w-3 h-3" />
                            Segretario Operativo
                          </div>
                        )}
                        <div className="ai-prose max-w-none">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                        <span className="text-[10px] text-muted-foreground mt-2 block">{msg.timestamp}</span>
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

            <VoicePresence active={micActive} listening={micActive} speaking={false} />

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
                    onClick={toggleMic}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all flex-shrink-0 ${
                      micActive
                        ? "bg-destructive/20 text-destructive ring-2 ring-destructive/40"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                    }`}
                  >
                    {micActive ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}
