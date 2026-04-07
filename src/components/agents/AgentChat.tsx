import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Mic, MicOff, Volume2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Agent } from "@/hooks/useAgents";
import { LazyMarkdown as ReactMarkdown } from "@/components/ui/lazy-markdown";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  agent: Agent;
}

export function AgentChat({ agent }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMessages([]); }, [agent.id]);
  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [messages]);

  const send = useCallback(async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInput("");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("agent-execute", {
        body: { agent_id: agent.id, chat_messages: newMsgs },
      });
      if (error) throw error;
      setMessages([...newMsgs, { role: "assistant", content: data?.response || "Nessuna risposta" }]);
    } catch (e) {
      setMessages([...newMsgs, { role: "assistant", content: "⚠️ Errore nella comunicazione con l'agente." }]);
    } finally {
      setLoading(false);
    }
  }, [input, messages, loading, agent.id]);

  const playTTS = async (text: string) => {
    if (!agent.elevenlabs_voice_id) return;
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
          body: JSON.stringify({ text: text.slice(0, 3000), voiceId: agent.elevenlabs_voice_id }),
        }
      );
      if (!res.ok) return;
      const blob = await res.blob();
      new Audio(URL.createObjectURL(blob)).play();
    } catch { /* audio playback not available */ }
  };

  return (
    <div className="flex flex-col h-[500px]">
      <h3 className="text-sm font-semibold mb-2">Chat con {agent.name}</h3>
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 p-3 rounded-lg bg-background/30 border border-border/30">
        {messages.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">
            Inizia una conversazione con {agent.name}
          </p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50"
              )}
            >
              {msg.role === "assistant" ? (
                <div className="flex items-start gap-2">
                  <div className="prose prose-sm dark:prose-invert prose-p:my-1 prose-headings:my-2 max-w-none">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                  {agent.elevenlabs_voice_id && (
                    <button onClick={() => playTTS(msg.content)} className="mt-1 flex-shrink-0 text-muted-foreground hover:text-foreground">
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-muted/50 rounded-lg px-3 py-2 text-sm">
              <span className="animate-pulse">⏳ {agent.name} sta pensando...</span>
            </div>
          </div>
        )}
      </div>
      {/* Input */}
      <div className="flex gap-2 mt-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={`Parla con ${agent.name}...`}
          className="text-sm"
          disabled={loading}
        />
        <Button size="icon" onClick={send} disabled={!input.trim() || loading}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
