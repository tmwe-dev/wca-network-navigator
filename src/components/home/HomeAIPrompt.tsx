import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Send, Loader2, Bot, X, Sparkles, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { cn } from "@/lib/utils";
import AIMarkdown from "@/components/intelliflow/AIMarkdown";
import { dispatchAiAgentEffects, parseAiAgentResponse } from "@/lib/ai/agentResponse";
import { useContinuousSpeech } from "@/hooks/useContinuousSpeech";
import type { BriefingAction, AgentStatusItem } from "@/hooks/useDailyBriefing";
import { createLogger } from "@/lib/log";

const log = createLogger("HomeAIPrompt");

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
  briefingActions?: BriefingAction[];
  agents?: AgentStatusItem[];
  externalPrompt?: string | null;
  onExternalPromptConsumed?: () => void;
}

interface SmartPrompt {
  label: string;
  prompt: string;
  icon: string;
}

function buildSmartPrompts(stats?: Props["systemStats"], briefingActions?: BriefingAction[]): SmartPrompt[] {
  // Use briefing actions if available
  if (briefingActions && briefingActions.length > 0) {
    return briefingActions.slice(0, 4).map((a) => ({
      label: a.label,
      prompt: a.prompt,
      icon: a.agentName ? "🤖" : "⚡",
    }));
  }

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

export function HomeAIPrompt({ className, systemStats, briefingActions, agents, externalPrompt, onExternalPromptConsumed }: Props) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [history, setHistory] = useState<{ role: string; content: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const speech = useContinuousSpeech((text) => setInput(text));

  const smartPrompts = useMemo(() => buildSmartPrompts(systemStats, briefingActions), [systemStats, briefingActions]);

  // Handle external prompt from briefing actions
  useEffect(() => {
    if (externalPrompt) {
      send(externalPrompt);
      onExternalPromptConsumed?.();
    }
  }, [externalPrompt]);

  const send = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput("");
    setLoading(true);
    setResponse(null);

    // Check for @AgentName routing
    const agentMatch = msg.match(/^@(\w+)\s+(.+)/i);
    let targetAgent: AgentStatusItem | undefined;
    let cleanMsg = msg;
    if (agentMatch && agents) {
      const name = agentMatch[1].toLowerCase();
      targetAgent = agents.find(a => a.name.toLowerCase() === name);
      if (targetAgent) cleanMsg = agentMatch[2];
    }

    const newMessages = [...history, { role: "user", content: cleanMsg }];

    try {
      let data: any;
      if (targetAgent) {
        // Route to agent-execute
        data = await invokeEdge<any>("agent-execute", {
          body: { agent_id: targetAgent.id, messages: newMessages },
          context: "HomeAIPrompt.agent_execute",
        });
      } else {
        // Default: ai-assistant
        data = await invokeEdge<any>("ai-assistant", {
          body: { messages: newMessages },
          context: "HomeAIPrompt.ai_assistant",
        });
      }
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
  }, [input, loading, history, agents]);

  const playTTS = async (text: string) => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ text: text.slice(0, 3000), voiceId: "FGY2WhTYpPnrIDTdsKH5" }),
        }
      );
      if (!res.ok) return;
      const blob = await res.blob();
      new Audio(URL.createObjectURL(blob)).play();
    } catch (e) { log.debug("best-effort operation failed", { error: e instanceof Error ? e.message : String(e) }); /* best-effort */ }
  };

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
              <div className="flex items-center gap-1">
                <button onClick={() => playTTS(response!)} className="text-muted-foreground hover:text-foreground transition-colors p-1">
                  <Volume2 className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => setResponse(null)} className="text-muted-foreground hover:text-foreground p-1">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
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
            aria-label="Invia"
            className={cn(
              "h-10 w-10 shrink-0 rounded-full transition-all",
              speech.listening
                ? "bg-destructive/20 text-destructive ring-2 ring-destructive/40"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={speech.toggle}
            aria-label={speech.listening ? "Stop ascolto" : "Parla"}
          >
            {speech.listening ? (
              <MicOff className="h-5 w-5 animate-pulse" />
            ) : (
              <Mic className="h-5 w-5" />
            )}
          </Button>

          <input
            ref={inputRef}
            value={speech.listening ? (input + (speech.interimText ? ` ${speech.interimText}` : "")) : input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={speech.listening ? "🎙 Sto ascoltando…" : "Chiedi al sistema qualsiasi cosa…"}
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
        {speech.listening && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center gap-2 text-xs text-destructive font-medium"
          >
            <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
            Ascolto in corso… (clicca il microfono per fermare)
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
