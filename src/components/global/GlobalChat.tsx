import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, Send, Loader2, Sparkles, Trash2, Rocket, Clock } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "react-router-dom";
import { AiResultsPanel, type StructuredPartner } from "@/components/operations/AiResultsPanel";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const STRUCTURED_DELIMITER = "---STRUCTURED_DATA---";
const JOB_CREATED_DELIMITER = "---JOB_CREATED---";

export interface JobCreatedInfo {
  job_id: string;
  country: string;
  mode: string;
  total_partners: number;
  estimated_time_minutes: number;
}

function parseStructuredMessage(content: string): { text: string; partners: StructuredPartner[]; jobCreated: JobCreatedInfo | null } {
  let text = content;
  let partners: StructuredPartner[] = [];
  let jobCreated: JobCreatedInfo | null = null;

  const jobIdx = text.indexOf(JOB_CREATED_DELIMITER);
  if (jobIdx !== -1) {
    const jsonStr = text.substring(jobIdx + JOB_CREATED_DELIMITER.length).trim();
    text = text.substring(0, jobIdx).trim();
    try { jobCreated = JSON.parse(jsonStr.split("\n")[0]); } catch { /* ignore */ }
  }

  const idx = text.indexOf(STRUCTURED_DELIMITER);
  if (idx !== -1) {
    const jsonStr = text.substring(idx + STRUCTURED_DELIMITER.length).trim();
    text = text.substring(0, idx).trim();
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed?.type === "partners" && Array.isArray(parsed.data)) partners = parsed.data;
    } catch { /* ignore */ }
  }

  return { text, partners, jobCreated };
}

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;

const QUICK_PROMPTS = [
  "Scarica tutti i partner",
  "Scarica partner USA",
  "Aggiorna profili mancanti",
  "Stato download attivi",
];

function JobCreatedBadge({ job }: { job: JobCreatedInfo }) {
  useEffect(() => {
    toast({
      title: "🚀 Download avviato",
      description: `${job.country} — ${job.total_partners} partner (${job.mode}). ~${job.estimated_time_minutes} min`,
    });
  }, [job.job_id]);

  return (
    <div className="mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-medium animate-pulse bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
      <Rocket className="w-3.5 h-3.5 shrink-0" />
      <span className="flex-1">
        Job creato per <strong>{job.country}</strong> — {job.total_partners} partner
      </span>
      <span className="flex items-center gap-1 opacity-70">
        <Clock className="w-3 h-3" />
        ~{job.estimated_time_minutes} min
      </span>
    </div>
  );
}

interface GlobalChatProps {
  onJobCreated?: (job: JobCreatedInfo) => void;
}

export function GlobalChat({ onJobCreated }: GlobalChatProps) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Detect job created in last message
  useEffect(() => {
    if (!onJobCreated || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.role !== "assistant") return;
    const { jobCreated } = parseStructuredMessage(last.content);
    if (jobCreated) onJobCreated(jobCreated);
  }, [messages, onJobCreated]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;
      const userMsg: Msg = { role: "user", content: text.trim() };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsLoading(true);

      let assistantSoFar = "";
      const upsertAssistant = (chunk: string) => {
        assistantSoFar += chunk;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
          }
          return [...prev, { role: "assistant", content: assistantSoFar }];
        });
      };

      try {
        const allMsgs = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        const resp = await fetch(CHAT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ messages: allMsgs }),
        });

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ error: "Errore di rete" }));
          upsertAssistant(`⚠️ ${err.error || "Errore durante la richiesta"}`);
          setIsLoading(false);
          return;
        }

        const contentType = resp.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const data = await resp.json();
          upsertAssistant(data.content || data.error || "Nessuna risposta");
          setIsLoading(false);
          return;
        }

        if (!resp.body) { upsertAssistant("Errore: nessun body"); setIsLoading(false); return; }

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
              if (content) upsertAssistant(content);
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
              if (content) upsertAssistant(content);
            } catch { /* ignore */ }
          }
        }
      } catch (e) {
        console.error("AI chat error:", e);
        upsertAssistant("⚠️ Errore di connessione. Riprova.");
      }

      setIsLoading(false);
    },
    [messages, isLoading]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
        <div className="p-1.5 rounded-lg bg-violet-500/20">
          <Sparkles className="w-4 h-4 text-violet-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-white">Assistente Download</h3>
          <p className="text-[10px] text-slate-400">Chiedi cosa scaricare in linguaggio naturale</p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="p-1.5 rounded-lg transition-colors hover:bg-white/10 text-slate-500"
            title="Nuova conversazione"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 py-8">
            <Bot className="w-12 h-12 text-white/10" />
            <p className="text-xs text-center text-slate-500">
              Chiedi di scaricare partner per paese,<br />aggiornare profili o verificare lo stato.
            </p>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {QUICK_PROMPTS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-[10px] px-2.5 py-1 rounded-full border border-white/10 text-slate-400 hover:bg-white/5 hover:text-slate-300 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                msg.role === "user"
                  ? "bg-violet-600/30 text-violet-100 border border-violet-500/20"
                  : "bg-white/5 text-slate-200 border border-white/5"
              }`}
            >
              {msg.role === "assistant" ? (() => {
                const { text, partners, jobCreated } = parseStructuredMessage(msg.content);
                return (
                  <>
                    <div className="prose prose-xs prose-invert max-w-none [&_table]:text-[10px] [&_th]:px-2 [&_td]:px-2 [&_p]:my-1 [&_li]:my-0.5">
                      <ReactMarkdown
                        components={{
                          a: ({ href, children }) => {
                            if (href?.startsWith("/")) {
                              return (
                                <button className="text-violet-400 hover:text-violet-300 underline underline-offset-2 font-medium" onClick={() => navigate(href!)}>
                                  {children}
                                </button>
                              );
                            }
                            return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
                          }
                        }}
                      >{text}</ReactMarkdown>
                    </div>
                    {partners.length > 0 && <AiResultsPanel partners={partners} />}
                    {jobCreated && <JobCreatedBadge job={jobCreated} />}
                  </>
                );
              })() : msg.content}
            </div>
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs bg-white/5 text-slate-400 border border-white/5">
              <Loader2 className="w-3 h-3 animate-spin" />
              Sto analizzando...
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-3 py-2.5 border-t border-white/10">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
            }}
            placeholder="Es: Scarica tutti i partner della Germania..."
            rows={1}
            className="flex-1 resize-none rounded-xl px-3 py-2 text-xs outline-none transition-colors bg-white/5 border border-white/10 text-white placeholder:text-slate-600 focus:border-violet-500/40"
            style={{ minHeight: "36px", maxHeight: "100px" }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            className={`p-2 rounded-xl transition-all ${
              input.trim() && !isLoading
                ? "bg-violet-600 hover:bg-violet-500 text-white"
                : "bg-white/5 text-slate-600"
            }`}
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
