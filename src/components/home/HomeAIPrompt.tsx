import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Send, Loader2, Bot, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import AIMarkdown from "@/components/intelliflow/AIMarkdown";
import { dispatchAiAgentEffects, parseAiAgentResponse } from "@/lib/ai/agentResponse";

interface Props {
  className?: string;
  systemStats?: {
    partnersWithoutContacts?: number;
    partnersWithoutEmail?: number;
    activeJobs?: number;
    pendingActivities?: number;
    pendingReminders?: number;
    totalPartners?: number;
  };
}

interface SmartPrompt {
  label: string;
  prompt: string;
  icon: string;
}

function buildSmartPrompts(stats?: Props["systemStats"]): SmartPrompt[] {
  const prompts: SmartPrompt[] = [];
  
  if (stats?.pendingActivities && stats.pendingActivities > 0) {
    prompts.push({ label: `${stats.pendingActivities} attività aperte`, prompt: "Mostrami le attività in scadenza e suggeriscimi come procedere", icon: "📋" });
  }
  if (stats?.partnersWithoutEmail && stats.partnersWithoutEmail > 20) {
    prompts.push({ label: "Partner senza email", prompt: `Ho ${stats.partnersWithoutEmail} partner senza email. Avvia una Deep Search per i più importanti`, icon: "🔍" });
  }
  if (stats?.pendingReminders && stats.pendingReminders > 0) {
    prompts.push({ label: `${stats.pendingReminders} reminder`, prompt: "Mostrami i reminder in scadenza", icon: "⏰" });
  }
  if (stats?.activeJobs && stats.activeJobs > 0) {
    prompts.push({ label: `${stats.activeJobs} job attivi`, prompt: "Qual è lo stato dei download attivi?", icon: "📥" });
  }
  
  // Fallback defaults if no contextual ones
  if (prompts.length === 0) {
    prompts.push(
      { label: "Riepilogo del giorno", prompt: "Riepilogo del giorno", icon: "📊" },
      { label: "Partner senza contatti", prompt: "Partner senza contatti", icon: "👥" },
      { label: "Campagne attive", prompt: "Campagne attive", icon: "📧" },
      { label: "Attività in scadenza", prompt: "Attività in scadenza", icon: "📋" },
    );
  }
  
  return prompts.slice(0, 4);
}

export function HomeAIPrompt({ className, systemStats }: Props) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [history, setHistory] = useState<{ role: string; content: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  const smartPrompts = useMemo(() => buildSmartPrompts(systemStats), [systemStats]);

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
      setListening(false);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
  }, []);

  const toggleMic = useCallback(() => {
    if (!recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      recognitionRef.current.start();
      setListening(true);
    }
  }, [listening]);

  const send = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput("");
    setLoading(true);
    setResponse(null);

    const newMessages = [...history, { role: "user", content: msg }];

    try {
      const { data, error } = await supabase.functions.invoke("ai-assistant", {
        body: { messages: newMessages },
      });
      if (error) throw error;
      const raw = data?.content || data?.message || "";
      dispatchAiAgentEffects(parseAiAgentResponse(raw));
      setResponse(raw);
      setHistory([...newMessages, { role: "assistant", content: raw }]);
    } catch (e: any) {
      setResponse("⚠️ " + (e.message || "Errore di comunicazione"));
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, history]);

  return (
    <div className={cn("w-full max-w-2xl mx-auto space-y-3", className)}>
      {/* Response panel */}
      <AnimatePresence>
        {response && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            className="rounded-2xl border border-border bg-card p-4 shadow-glass backdrop-blur-2xl"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
                <Bot className="h-3.5 w-3.5" />
                Segretario Operativo
              </div>
              <button onClick={() => setResponse(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="ai-prose max-w-none">
              <AIMarkdown content={response} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Prompt bar */}
      <div className="relative rounded-2xl border border-border bg-card shadow-glass backdrop-blur-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2.5 sm:px-4 sm:py-3">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-10 w-10 shrink-0 rounded-full transition-all",
              listening
                ? "bg-destructive/20 text-destructive ring-2 ring-destructive/40"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={toggleMic}
            aria-label={listening ? "Stop ascolto" : "Parla"}
          >
            {listening ? (
              <MicOff className="h-5 w-5 animate-pulse" />
            ) : (
              <Mic className="h-5 w-5" />
            )}
          </Button>

          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Chiedi al sistema qualsiasi cosa…"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            disabled={loading}
          />

          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-10 w-10 shrink-0 rounded-full",
              input.trim()
                ? "text-primary hover:bg-primary/15"
                : "text-muted-foreground"
            )}
            onClick={() => send()}
            disabled={loading || !input.trim()}
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>

        {/* Smart contextual prompts */}
        {!response && !loading && (
          <div className="flex items-center gap-1.5 px-3 pb-2.5 sm:px-4 sm:pb-3 flex-wrap">
            <Sparkles className="h-3 w-3 text-muted-foreground shrink-0" />
            {smartPrompts.map((q) => (
              <button
                key={q.label}
                onClick={() => send(q.prompt)}
                className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-card transition-colors font-medium"
              >
                {q.icon} {q.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {listening && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center gap-2 text-xs text-destructive font-medium"
          >
            <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
            Ascolto in corso…
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
