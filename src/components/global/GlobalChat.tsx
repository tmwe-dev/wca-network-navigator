import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, Send, Loader2, Sparkles, Plus, Mic, MicOff, MessageSquare, Zap, Volume2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AiResultsPanel, type StructuredPartner } from "@/components/operations/AiResultsPanel";
import { LiveOperationCards } from "@/components/ai/LiveOperationCards";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAIConversation, type ConversationMessage } from "@/hooks/useAIConversation";
import AIMarkdown from "@/components/intelliflow/AIMarkdown";
import { dispatchAiAgentEffects, parseAiAgentResponse, type JobCreatedInfo } from "@/lib/ai/agentResponse";
import { createLogger } from "@/lib/log";

const log = createLogger("GlobalChat");
import { useContinuousSpeech } from "@/hooks/useContinuousSpeech";
import { useAppSettings } from "@/hooks/useAppSettings";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;
const SUPER_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/super-assistant`;
const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`;

const QUICK_PROMPTS = [
  "Scarica tutti i partner",
  "Scarica partner USA",
  "Aggiorna profili mancanti",
  "Stato download attivi",
];

interface GlobalChatProps {
  onJobCreated?: (job: JobCreatedInfo) => void;
}

async function playTTS(text: string, voiceId: string): Promise<void> {
  // Strip markdown for cleaner TTS
  const cleanText = text.replace(/[#*_~`>\[\]()!|]/g, "").replace(/\n{2,}/g, ". ").trim();
  if (!cleanText || cleanText.length < 5) return;
  // Limit to ~500 chars for cost
  const truncated = cleanText.length > 500 ? cleanText.slice(0, 500) + "..." : cleanText;

  const resp = await fetch(TTS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ text: truncated, voiceId }),
  });
  if (!resp.ok) throw new Error("TTS error");
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.onended = () => URL.revokeObjectURL(url);
  await audio.play();
}

export function GlobalChat({ onJobCreated }: GlobalChatProps) {
  const navigate = useNavigate();
  const { data: appSettings } = useAppSettings();
  const {
    messages, addMessages, newConversation,
  } = useAIConversation("global");

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<"operational" | "conversational">("operational");
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const ttsEnabled = appSettings?.elevenlabs_tts_enabled === "true";
  const defaultVoiceId = appSettings?.elevenlabs_default_voice_id || "JBFqnCBsd6RMkjVDRZzb";

  const speech = useContinuousSpeech((text) => setInput(text));

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    if (!onJobCreated || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.role !== "assistant") return;
    const parsed = parseAiAgentResponse<StructuredPartner>(last.content);
    if (parsed.jobCreated) onJobCreated(parsed.jobCreated);
  }, [messages, onJobCreated]);

  const handleReplay = useCallback(async (content: string, idx: number) => {
    if (playingIdx !== null) return;
    setPlayingIdx(idx);
    try {
      await playTTS(content, defaultVoiceId);
    } catch {
      toast({ title: "Errore TTS", description: "Impossibile riprodurre l'audio", variant: "destructive" });
    } finally {
      setPlayingIdx(null);
    }
  }, [playingIdx, defaultVoiceId]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;
      const userMsg: ConversationMessage = { role: "user", content: text.trim() };
      const prevMessages = [...messages, userMsg];
      await addMessages([userMsg]);
      setInput("");
      setIsLoading(true);

      let assistantContent = "";

      try {
        const allMsgs = prevMessages.map((m) => ({ role: m.role, content: m.content }));
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        const url = mode === "conversational" ? SUPER_URL : CHAT_URL;

        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(mode === "conversational"
            ? { messages: allMsgs, pageContext: "global-chat" }
            : { messages: allMsgs }),
        });

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ error: "Errore di rete" }));
          assistantContent = `⚠️ ${err.error || "Errore durante la richiesta"}`;
        } else {
          const contentType = resp.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            const data = await resp.json();
            assistantContent = data.content || data.error || "Nessuna risposta";
          } else if (resp.body) {
            const reader = resp.body.getReader();
            const decoder = new TextDecoder();
            let textBuffer = "";

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              textBuffer += decoder.decode(value, { stream: true });
              let newlineIndex: number;
              while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
                let line = textBuffer.slice(0, newlineIndex);
                textBuffer = textBuffer.slice(newlineIndex + 1);
                if (line.endsWith("\r")) line = line.slice(0, -1);
                if (line.startsWith(":") || line.trim() === "") continue;
                if (!line.startsWith("data: ")) continue;
                const jsonStr = line.slice(6).trim();
                if (jsonStr === "[DONE]") break;
                try {
                  const parsed = JSON.parse(jsonStr);
                  const content = parsed.choices?.[0]?.delta?.content;
                  if (content) assistantContent += content;
                } catch { textBuffer = line + "\n" + textBuffer; break; }
              }
            }
            if (textBuffer.trim()) {
              for (let raw of textBuffer.split("\n")) {
                if (!raw) continue;
                if (raw.endsWith("\r")) raw = raw.slice(0, -1);
                if (raw.startsWith(":") || raw.trim() === "") continue;
                if (!raw.startsWith("data: ")) continue;
                const jsonStr = raw.slice(6).trim();
                if (jsonStr === "[DONE]") continue;
                try {
                  const parsed = JSON.parse(jsonStr);
                  const content = parsed.choices?.[0]?.delta?.content;
                  if (content) assistantContent += content;
                } catch { /* ignore */ }
              }
            }
          } else {
            assistantContent = "Errore: nessun body";
          }
        }
      } catch (e) {
        log.error("ai chat error", { message: e instanceof Error ? e.message : String(e) });
        assistantContent = "⚠️ Errore di connessione. Riprova.";
      }

      const parsed = parseAiAgentResponse<StructuredPartner>(assistantContent);
      dispatchAiAgentEffects(parsed);
      if (parsed.jobCreated && onJobCreated) {
        onJobCreated(parsed.jobCreated);
      }
      await addMessages([{ role: "assistant", content: assistantContent }]);
      setIsLoading(false);

      // Auto-play TTS if enabled
      if (ttsEnabled && defaultVoiceId && !assistantContent.startsWith("⚠️")) {
        playTTS(assistantContent, defaultVoiceId).catch(() => {});
      }
    },
    [messages, isLoading, addMessages, ttsEnabled, defaultVoiceId, mode, onJobCreated],
  );

  const renderAssistantMessage = (content: string, idx: number) => {
    const parsed = parseAiAgentResponse<StructuredPartner>(content);
    return (
      <>
        <div className="prose prose-xs prose-invert max-w-none [&_table]:text-[10px] [&_th]:px-2 [&_td]:px-2 [&_p]:my-1 [&_li]:my-0.5">
          <AIMarkdown content={parsed.text} />
        </div>
        {parsed.operations.length > 0 && <LiveOperationCards operations={parsed.operations} />}
        {parsed.partners.length > 0 && <AiResultsPanel partners={parsed.partners} />}
        {/* Replay button */}
        <button
          onClick={() => handleReplay(content, idx)}
          disabled={playingIdx !== null}
          className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
          title="Riascolta"
        >
          {playingIdx === idx ? <Loader2 className="w-3 h-3 animate-spin" /> : <Volume2 className="w-3 h-3" />}
          <span>{playingIdx === idx ? "Riproduzione..." : "Ascolta"}</span>
        </button>
      </>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
        <div className="p-1.5 rounded-lg bg-primary/20"><Sparkles className="w-4 h-4 text-primary" /></div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-foreground">Assistente AI</h3>
          <p className="text-[10px] text-muted-foreground">Operativo & Strategico</p>
        </div>
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
        {messages.length > 0 && (
          <button onClick={newConversation} className="p-1.5 rounded-lg transition-colors hover:bg-secondary/50 text-muted-foreground" title="Nuova conversazione">
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 py-8">
            <Bot className="w-12 h-12 text-white/10" />
            <p className="text-xs text-center text-slate-500">Chiedi di scaricare partner per paese,<br />aggiornare profili o verificare lo stato.</p>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {QUICK_PROMPTS.map((q) => (
                <button key={q} onClick={() => sendMessage(q)} className="text-[10px] px-2.5 py-1 rounded-full border border-white/10 text-slate-400 hover:bg-white/5 hover:text-slate-300 transition-colors">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
              msg.role === "user"
                ? "bg-violet-600/30 text-violet-100 border border-violet-500/20"
                : "bg-white/5 text-slate-200 border border-white/5"
            }`}>
              {msg.role === "assistant" ? renderAssistantMessage(msg.content, i) : msg.content}
            </div>
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs bg-white/5 text-slate-400 border border-white/5">
              <Loader2 className="w-3 h-3 animate-spin" />Sto analizzando...
            </div>
          </div>
        )}
      </div>

      <div className="px-3 py-2.5 border-t border-white/10">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
            placeholder="Es: Scarica tutti i partner della Germania..."
            rows={1}
            className="flex-1 resize-none rounded-xl px-3 py-2 text-xs outline-none transition-colors bg-white/5 border border-white/10 text-white placeholder:text-slate-600 focus:border-violet-500/40"
            style={{ minHeight: "36px", maxHeight: "100px" }}
          />
          {speech.hasSpeechAPI && (
            <button onClick={speech.toggle} className={`p-2 rounded-xl transition-all ${speech.listening ? "bg-destructive/20 text-destructive animate-pulse border border-destructive/30" : "bg-secondary/30 text-muted-foreground hover:text-foreground hover:bg-secondary/50"}`} title={speech.listening ? "Stop dettatura" : "Detta con microfono"}>
              {speech.listening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            </button>
          )}
          <button onClick={() => sendMessage(input)} disabled={!input.trim() || isLoading} className={`p-2 rounded-xl transition-all ${input.trim() && !isLoading ? "bg-violet-600 hover:bg-violet-500 text-white" : "bg-white/5 text-slate-600"}`}>
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
