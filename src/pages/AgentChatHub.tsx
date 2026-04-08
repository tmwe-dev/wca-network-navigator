import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Volume2, Loader2, Wrench, Circle, Mic, MicOff, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAgents, type Agent } from "@/hooks/useAgents";
import { AgentAvatarCarousel } from "@/components/agents/AgentAvatarCarousel";
import { AgentVoiceCall } from "@/components/agents/AgentVoiceCall";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { LazyMarkdown as ReactMarkdown } from "@/components/ui/lazy-markdown";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

// STT hook
function useSpeechRecognition(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);

  const toggle = useCallback(() => {
    if (listening && recRef.current) {
      recRef.current.stop();
      setListening(false);
      return;
    }
    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = "it-IT";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e: any) => {
      let final = "";
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
      }
      if (final) onResult(final);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
    recRef.current = rec;
    setListening(true);
  }, [listening, onResult]);

  useEffect(() => () => { recRef.current?.stop(); }, []);

  return { listening, toggle };
}

export default function AgentChatHub() {
  const { agents, isLoading } = useAgents();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [voiceCallOpen, setVoiceCallOpen] = useState(false);
  const chatMapRef = useRef<Map<string, Message[]>>(new Map());
  const [, forceRender] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const appendInput = useCallback((text: string) => {
    setInput((prev) => (prev ? prev + " " + text : text));
  }, []);
  const { listening, toggle: toggleSTT } = useSpeechRecognition(appendInput);

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
      const data = await invokeEdge<any>("agent-execute", { body: { agent_id: activeId, chat_messages: newMsgs }, context: "AgentChatHub.agent_execute" });
      const reply: Message = { role: "assistant", content: data?.response || "Nessuna risposta" };
      chatMapRef.current.set(activeId, [...newMsgs, reply]);
    } catch {
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
    } catch { /* intentionally ignored: best-effort cleanup */ }
  };

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
            variant={listening ? "destructive" : "outline"}
            onClick={toggleSTT}
            disabled={!activeAgent}
            className={cn("rounded-xl relative", listening && "animate-pulse")}
            title={listening ? "Stop dettatura" : "Dettatura vocale"}
          >
            {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            {listening && (
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
          >
            <Phone className="w-4 h-4" />
          </Button>

          {/* Send */}
          <Button size="icon" onClick={send} disabled={!input.trim() || sending || !activeAgent} className="rounded-xl">
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
