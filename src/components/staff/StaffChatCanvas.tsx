import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Mic, MicOff, Volume2, Loader2, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { LazyMarkdown as ReactMarkdown } from "@/components/ui/lazy-markdown";
import { cn } from "@/lib/utils";
import { useContinuousSpeech } from "@/hooks/useContinuousSpeech";
import { FileDropZone } from "./FileDropZone";
import { supabase } from "@/integrations/supabase/client";
import type { Agent } from "@/hooks/useAgents";
import { createLogger } from "@/lib/log";

const log = createLogger("StaffChatCanvas");

interface Message {
  role: "user" | "assistant";
  content: string;
  attachments?: { url: string; name: string }[];
}

interface Props {
  agent: Agent;
}

export function StaffChatCanvas({ agent }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<{ url: string; name: string }[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const speech = useContinuousSpeech((text) => {
    setInput((prev) => (prev ? prev + " " + text : text));
  });

  useEffect(() => { setMessages([]); }, [agent.id]);
  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [messages]);

  const handleFileUploaded = useCallback((url: string, name: string) => {
    setPendingFiles((prev) => [...prev, { url, name }]);
  }, []);

  const handleManualUpload = useCallback(async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      const path = `staff/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("chat-attachments").upload(path, file);
      if (!error) {
        const { data } = supabase.storage.from("chat-attachments").getPublicUrl(path);
        setPendingFiles((prev) => [...prev, { url: data.publicUrl, name: file.name }]);
      }
    }
  }, []);

  const send = useCallback(async () => {
    if ((!input.trim() && pendingFiles.length === 0) || loading) return;

    let content = input.trim();
    if (pendingFiles.length > 0) {
      const fileList = pendingFiles.map((f) => `[📎 ${f.name}](${f.url})`).join("\n");
      content = content ? `${content}\n\nAllegati:\n${fileList}` : `Allegati:\n${fileList}`;
    }

    const userMsg: Message = { role: "user", content, attachments: [...pendingFiles] };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInput("");
    setPendingFiles([]);
    setLoading(true);

    try {
      const data = await invokeEdge<any>("agent-execute", {
        body: { agent_id: agent.id, chat_messages: newMsgs.map((m) => ({ role: m.role, content: m.content })) },
        context: "StaffChatCanvas.agent_execute",
      });
      setMessages([...newMsgs, { role: "assistant", content: data?.response || "Nessuna risposta" }]);
    } catch (e) {
      log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) });
      setMessages([...newMsgs, { role: "assistant", content: "⚠️ Errore nella comunicazione." }]);
    } finally {
      setLoading(false);
    }
  }, [input, messages, loading, agent.id, pendingFiles]);

  const playTTS = async (text: string) => {
    if (!agent.elevenlabs_voice_id) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ text: text.slice(0, 3000), voiceId: agent.elevenlabs_voice_id }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      new Audio(URL.createObjectURL(blob)).play();
    } catch (e) { log.debug("best-effort operation failed", { error: e instanceof Error ? e.message : String(e) }); /* best-effort */ }
  };

  return (
    <FileDropZone onFileUploaded={handleFileUploaded} className="flex flex-col h-full">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <span className="text-5xl">{agent.avatar_emoji}</span>
            <p className="text-sm font-medium">{agent.name}</p>
            <p className="text-xs">{agent.role}</p>
            <p className="text-xs text-center max-w-sm mt-2">
              Trascina file qui o usa il microfono per dettare istruzioni.
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn(
              "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
              msg.role === "user" ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted/50 rounded-bl-md"
            )}>
              {msg.role === "assistant" ? (
                <div className="flex items-start gap-2">
                  <div className="prose prose-sm dark:prose-invert prose-p:my-1 max-w-none flex-1">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                  {agent.elevenlabs_voice_id && (
                    <button onClick={() => playTTS(msg.content)} className="mt-1 flex-shrink-0 text-muted-foreground hover:text-foreground">
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ) : (
                <div>
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-muted/50 rounded-2xl rounded-bl-md px-4 py-2.5 text-sm flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="animate-pulse">{agent.name} sta pensando…</span>
            </div>
          </div>
        )}
      </div>

      {/* Pending files */}
      {pendingFiles.length > 0 && (
        <div className="px-4 py-1 flex gap-2 flex-wrap">
          {pendingFiles.map((f, i) => (
            <span key={i} className="text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
              📎 {f.name}
              <button onClick={() => setPendingFiles((p) => p.filter((_, j) => j !== i))} className="hover:text-destructive">×</button>
            </span>
          ))}
        </div>
      )}

      {/* Input bar */}
      <div className="border-t border-border/40 px-4 py-3">
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleManualUpload(e.target.files)}
          />
          <Button
            size="icon"
            aria-label="Carica"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-xl shrink-0"
            title="Allega file"
          >
            <Paperclip className="w-4 h-4" />
          </Button>
          <input
            value={speech.listening ? (input + (speech.interimText ? ` ${speech.interimText}` : "")) : input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            placeholder={speech.listening ? "🎙 Sto ascoltando…" : `Istruzioni per ${agent.name}…`}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none border border-border rounded-xl px-3 py-2"
            disabled={loading}
          />
          <Button
            size="icon"
            variant={speech.listening ? "destructive" : "outline"}
            onClick={speech.toggle}
            className={cn("rounded-xl relative shrink-0", speech.listening && "animate-pulse")}
           aria-label="Stop dettatura">
            {speech.listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            {speech.listening && <span className="absolute -top-1 -right-1 w-2 h-2 bg-destructive rounded-full animate-ping" />}
          </Button>
          <Button size="icon" onClick={send} disabled={(!input.trim() && pendingFiles.length === 0) || loading} className="rounded-xl shrink-0" aria-label="Invia">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </FileDropZone>
  );
}
