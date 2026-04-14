import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Volume2, Loader2, Wrench, Circle, Mic, MicOff, Phone, BookOpen, ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAgents } from "@/hooks/useAgents";
import { AgentAvatarCarousel } from "@/components/agents/AgentAvatarCarousel";
import { AgentVoiceCall } from "@/components/agents/AgentVoiceCall";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { LazyMarkdown as ReactMarkdown } from "@/components/ui/lazy-markdown";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AgentSystemDirectory } from "@/components/agents/AgentSystemDirectory";
import { useContinuousSpeech } from "@/hooks/useContinuousSpeech";
import { createLogger } from "@/lib/log";

const log = createLogger("AgentChatHub");

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function AgentChatHub() {
  const { agents, isLoading } = useAgents();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [voiceCallOpen, setVoiceCallOpen] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<Set<string>>(new Set());
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const chatMapRef = useRef<Map<string, Message[]>>(new Map());
  const [, forceRender] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const speech = useContinuousSpeech((text) => {
    setInput((prev) => (prev ? prev + " " + text : text));
  });

  useEffect(() => {
    if (!activeId && agents.length > 0) setActiveId(agents[0].id);
  }, [agents, activeId]);

  const activeAgent = agents.find((a) => a.id === activeId) ?? null;
  const messages = activeId ? chatMapRef.current.get(activeId) ?? [] : [];

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages.length, activeId]);

  const send = useCallback(async () => {
    if (!input.trim() || sending || !activeId || !activeAgent) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    const prev = chatMapRef.current.get(activeId) ?? [];
    const newMsgs = [...prev, userMsg];
    chatMapRef.current.set(activeId, newMsgs);
    setInput("");
    setSending(true);
    forceRender((n) => n + 1);

    try {
      const data = await invokeEdge<Record<string, unknown>>("agent-execute", { body: { agent_id: activeId, chat_messages: newMsgs }, context: "AgentChatHub.agent_execute" });
      const reply: Message = { role: "assistant", content: String(data?.response || "Nessuna risposta") };
      chatMapRef.current.set(activeId, [...newMsgs, reply]);
    } catch (e) {
      log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) });
      chatMapRef.current.set(activeId, [...newMsgs, { role: "assistant", content: "⚠️ Errore nella comunicazione." }]);
    } finally {
      setSending(false);
      forceRender((n) => n + 1);
    }
  }, [input, sending, activeId, activeAgent]);

  const playTTS = async (text: string) => {
    if (!activeAgent?.elevenlabs_voice_id) return;
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
          body: JSON.stringify({ text: text.slice(0, 3000), voiceId: activeAgent.elevenlabs_voice_id }),
        }
      );
      if (!res.ok) return;
      const blob = await res.blob();
      new Audio(URL.createObjectURL(blob)).play();
    } catch (e) { log.debug("best-effort operation failed", { error: e instanceof Error ? e.message : String(e) }); /* intentionally ignored: best-effort cleanup */ }
  };

  const handleFeedback = useCallback(async (msgIndex: number, type: "positive" | "negative") => {
    const key = `${activeId}-${msgIndex}`;
    if (feedbackGiven.has(key)) return;
    setFeedbackGiven(prev => new Set(prev).add(key));

    const msgs = activeId ? chatMapRef.current.get(activeId) ?? [] : [];
    const msg = msgs[msgIndex];
    const userMsg = msgs[msgIndex - 1];

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (type === "negative") {
        await invokeEdge("save-correction-memory", {
          body: {
            correction_type: "chat_response_negative",
            original_value: msg?.content?.substring(0, 300) || "",
            corrected_value: "Risposta non soddisfacente",
            context: `Risposta AI non soddisfacente. Domanda utente: "${userMsg?.content?.substring(0, 200) || ""}". Migliorare su questo tipo di richiesta.`,
          },
          context: "AgentChatHub.feedback",
        });
        toast.info("Feedback registrato — l'AI migliorerà");
      } else {
        await (supabase.from("ai_memory") as any).insert({  // eslint-disable-line @typescript-eslint/no-explicit-any -- table not in schema
          user_id: user.id,
          memory_type: "preference",
          content: `L'utente ha apprezzato la risposta per: "${userMsg?.content?.substring(0, 200) || ""}". Mantieni questo stile.`,
          tags: ["feedback_positivo", "stile_approvato"],
          level: 1,
          importance: 3,
          confidence: 0.7,
          decay_rate: 0.01,
          source: "user_positive_feedback",
        });
        toast.success("Feedback positivo registrato");
      }
    } catch (e) {
      log.debug("feedback save failed", { error: e instanceof Error ? e.message : String(e) });
    }
  }, [activeId, feedbackGiven]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Carousel */}
      <div className="border-b border-border/40 bg-card/30 backdrop-blur-sm">
        <AgentAvatarCarousel agents={agents} activeId={activeId} onSelect={setActiveId} />
      </div>

      {/* Agent header */}
      <AnimatePresence mode="wait">
        {activeAgent && (
          <motion.div
            key={activeAgent.id}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-3 px-6 py-3 border-b border-border/30"
          >
            <span className="text-3xl">{activeAgent.avatar_emoji}</span>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-semibold text-foreground truncate">{activeAgent.name}</h2>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="capitalize">{activeAgent.role}</span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Wrench className="w-3 h-3" />
                  {activeAgent.assigned_tools?.length ?? 0} tool
                </span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Circle className={cn("w-2 h-2 fill-current", activeAgent.is_active ? "text-emerald-500" : "text-muted-foreground")} />
                  {activeAgent.is_active ? "Attivo" : "Inattivo"}
                </span>
              </div>
            </div>
            <Button
              size="sm"
              variant={directoryOpen ? "default" : "outline"}
              onClick={() => setDirectoryOpen(!directoryOpen)}
              className="rounded-lg text-xs gap-1.5"
            >
              <BookOpen className="w-3.5 h-3.5" />
              Directory
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* System Directory Panel */}
      <AnimatePresence>
        {directoryOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-b border-border/30"
          >
            <div className="max-h-[40vh] overflow-y-auto px-4 py-3">
              <AgentSystemDirectory />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-8 py-4 space-y-3">
        {messages.length === 0 && activeAgent && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <span className="text-5xl">{activeAgent.avatar_emoji}</span>
            <p className="text-sm">Inizia una conversazione con {activeAgent.name}</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <motion.div
            key={`${activeId}-${i}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15, delay: i > messages.length - 3 ? 0.05 : 0 }}
            className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[80%] md:max-w-[65%] rounded-2xl px-4 py-2.5 text-sm",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "bg-muted/50 rounded-bl-md"
              )}
            >
              {msg.role === "assistant" ? (
                <div>
                  <div className="flex items-start gap-2">
                    <div className="prose prose-sm dark:prose-invert prose-p:my-1 prose-headings:my-2 max-w-none flex-1">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                    {activeAgent?.elevenlabs_voice_id && (
                      <button onClick={() => playTTS(msg.content)} className="mt-1 flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors">
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-1.5 -ml-1">
                    <button
                      onClick={() => handleFeedback(i, "positive")}
                      disabled={feedbackGiven.has(`${activeId}-${i}`)}
                      className={cn(
                        "p-1 rounded-full transition-colors",
                        feedbackGiven.has(`${activeId}-${i}`) ? "text-muted-foreground/30" : "text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10"
                      )}
                    >
                      <ThumbsUp className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleFeedback(i, "negative")}
                      disabled={feedbackGiven.has(`${activeId}-${i}`)}
                      className={cn(
                        "p-1 rounded-full transition-colors",
                        feedbackGiven.has(`${activeId}-${i}`) ? "text-muted-foreground/30" : "text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                      )}
                    >
                      <ThumbsDown className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ) : (
                msg.content
              )}
            </div>
          </motion.div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-muted/50 rounded-2xl rounded-bl-md px-4 py-2.5 text-sm">
              <span className="animate-pulse flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {activeAgent?.name} sta pensando…
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="border-t border-border/40 bg-card/30 backdrop-blur-sm px-4 md:px-8 py-3">
        <div className="flex gap-2 max-w-3xl mx-auto">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            placeholder={activeAgent ? `Scrivi a ${activeAgent.name}…` : "Seleziona un agente"}
            className="text-sm rounded-xl bg-background/60"
            disabled={sending || !activeAgent}
          />

          {/* STT mic */}
          <Button
            size="icon"
            aria-label="Chiama"
            variant={speech.listening ? "destructive" : "outline"}
            onClick={speech.toggle}
            disabled={!activeAgent}
            className={cn("rounded-xl relative", speech.listening && "animate-pulse")}
            title={speech.listening ? "Stop dettatura" : "Dettatura vocale"}
          >
            {speech.listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            {speech.listening && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-destructive rounded-full animate-ping" />
            )}
          </Button>

          {/* Voice call */}
          <Button
            size="icon"
            variant="outline"
            onClick={() => setVoiceCallOpen(true)}
            disabled={!activeAgent?.elevenlabs_agent_id}
            className="rounded-xl"
            title="Chiamata vocale"
            aria-label="Chiamata vocale"
          >
            <Phone className="w-4 h-4" />
          </Button>

          {/* Send */}
          <Button size="icon" aria-label="Invia" onClick={send} disabled={!input.trim() || sending || !activeAgent} className="rounded-xl">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Voice call overlay */}
      {voiceCallOpen && activeAgent && (
        <AgentVoiceCall agent={activeAgent} onClose={() => setVoiceCallOpen(false)} />
      )}
    </div>
  );
}
