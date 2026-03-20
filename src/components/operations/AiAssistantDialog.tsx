import { useState, useRef, useEffect, useCallback, useContext } from "react";
import { Bot, Send, X, Loader2, Sparkles, Trash2, Rocket, Clock, Volume2, VolumeX, Mic, MicOff, ListChecks } from "lucide-react";
import { ThemeCtx, t } from "@/components/download/theme";
import ReactMarkdown from "react-markdown";
import { useNavigate, useLocation } from "react-router-dom";
import { AiResultsPanel, type StructuredPartner } from "./AiResultsPanel";
import { LiveOperationCards } from "@/components/ai/LiveOperationCards";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ActivePlansBadge } from "./ai/ActivePlansBadge";
import { parseAiAgentResponse } from "@/lib/ai/agentResponse";
const STRUCTURED_DELIMITER = "---STRUCTURED_DATA---";
const JOB_CREATED_DELIMITER = "---JOB_CREATED---";
const UI_ACTIONS_DELIMITER = "---UI_ACTIONS---";

export interface JobCreatedInfo {
  job_id: string;
  country: string;
  mode: string;
  total_partners: number;
  estimated_time_minutes: number;
}

export interface UiAction {
  action_type: "navigate" | "show_toast" | "apply_filters" | "open_dialog";
  path?: string;
  message?: string;
  toast_type?: "default" | "success" | "error";
  filters?: Record<string, unknown>;
  dialog?: string;
}

function parseStructuredMessage(content: string): {
  text: string;
  partners: StructuredPartner[];
  jobCreated: JobCreatedInfo | null;
  uiActions: UiAction[];
} {
  let text = content;
  let partners: StructuredPartner[] = [];
  let jobCreated: JobCreatedInfo | null = null;
  let uiActions: UiAction[] = [];

  const uiIdx = text.indexOf(UI_ACTIONS_DELIMITER);
  if (uiIdx !== -1) {
    const jsonStr = text.substring(uiIdx + UI_ACTIONS_DELIMITER.length).trim();
    text = text.substring(0, uiIdx).trim();
    try { uiActions = JSON.parse(jsonStr.split("\n\n")[0]); } catch { /* ignore */ }
  }

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

  return { text, partners, jobCreated, uiActions };
}

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;
const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`;

const PAGE_QUICK_PROMPTS: Record<string, string[]> = {
  default: [
    "Riepilogo globale del database",
    "Paesi con più profili mancanti",
    "Job attivi in questo momento",
    "Partner con rating più alto",
  ],
  "/partner-hub": [
    "Mostra partner per rating",
    "Paesi con gap nella directory",
    "Partner senza email",
    "Verifica blacklist",
  ],
  "/contacts": [
    "Contatti importati per origine",
    "Contatti senza email",
    "Statistiche per paese",
    "Contatti più recenti",
  ],
  "/import": [
    "Ultimo import effettuato",
    "Errori di importazione",
    "Contatti da trasferire",
    "Statistiche import",
  ],
  "/workspace": [
    "Genera email di presentazione",
    "Partner con email per campagna",
    "Top partner per servizi",
    "Template disponibili",
  ],
};

const VOICES = [
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", lang: "🇺🇸" },
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura", lang: "🇮🇹" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", lang: "🇬🇧" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", lang: "🇬🇧" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", lang: "🇬🇧" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam", lang: "🇺🇸" },
];

function JobCreatedBadge({ job, isDark }: { job: JobCreatedInfo; isDark: boolean }) {
  useEffect(() => {
    toast({
      title: "🚀 Download avviato dall'AI",
      description: `${job.country} — ${job.total_partners} partner (${job.mode}). ~${job.estimated_time_minutes} min`,
    });
  }, [job.job_id]);

  return (
    <div className={`mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-medium animate-pulse ${
      isDark ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300" : "bg-emerald-50 border border-emerald-200 text-emerald-700"
    }`}>
      <Rocket className="w-3.5 h-3.5 shrink-0" />
      <span className="flex-1">Job creato per <strong>{job.country}</strong> — {job.total_partners} partner</span>
      <span className="flex items-center gap-1 opacity-70"><Clock className="w-3 h-3" />~{job.estimated_time_minutes} min</span>
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  context?: {
    selectedCountries: { code: string; name: string }[];
    filterMode: string;
  };
}

export function AiAssistantDialog({ open, onClose, context }: Props) {
  const isDark = useContext(ThemeCtx);
  const th = t(isDark);
  const navigate = useNavigate();
  const location = useLocation();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [activePlans, setActivePlans] = useState<any[]>([]);

  // Voice state
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(VOICES[1].id);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastSpokenIdxRef = useRef(-1);

  // Mic state
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const hasSpeechAPI = typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);

  // Get quick prompts based on current page
  const currentPage = location.pathname;
  const quickPrompts = PAGE_QUICK_PROMPTS[currentPage] || PAGE_QUICK_PROMPTS.default;

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Load active plans on open
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;
      const { data } = await supabase.from("ai_work_plans")
        .select("id, title, status, steps, current_step, tags")
        .eq("user_id", session.user.id)
        .in("status", ["running", "paused"])
        .order("created_at", { ascending: false })
        .limit(5);
      setActivePlans(data || []);
    })();
  }, [open, messages.length]);

  // Handle UI actions dispatched by AI
  const handleUiActions = useCallback((actions: UiAction[]) => {
    for (const action of actions) {
      switch (action.action_type) {
        case "navigate":
          if (action.path) {
            navigate(action.path);
            onClose();
          }
          break;
        case "show_toast":
          toast({
            title: action.toast_type === "error" ? "⚠️ Errore" : action.toast_type === "success" ? "✅ Fatto" : "ℹ️ Info",
            description: action.message || "",
          });
          break;
        case "apply_filters":
          window.dispatchEvent(new CustomEvent("ai-command", { detail: { filters: action.filters } }));
          break;
        case "open_dialog":
          window.dispatchEvent(new CustomEvent("ai-ui-action", { detail: action }));
          break;
      }
    }
  }, [navigate, onClose]);

  // Auto-play TTS
  useEffect(() => {
    if (!voiceEnabled || isLoading || messages.length === 0) return;
    const lastIdx = messages.length - 1;
    const last = messages[lastIdx];
    if (last.role !== "assistant" || lastIdx <= lastSpokenIdxRef.current) return;
    lastSpokenIdxRef.current = lastIdx;
    const { text } = parseStructuredMessage(last.content);
    if (!text || text.startsWith("⚠️")) return;
    const cleanText = text.replace(/[#*_`~\[\]()>|]/g, "").replace(/\n{2,}/g, ". ").replace(/\n/g, " ").trim();
    if (cleanText.length < 5) return;
    playTTS(cleanText);
  }, [messages, isLoading, voiceEnabled]);

  const playTTS = useCallback(async (text: string) => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setIsSpeaking(true);
    try {
      const response = await fetch(TTS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ text: text.slice(0, 2000), voiceId: selectedVoice }),
      });
      if (!response.ok) { setIsSpeaking(false); return; }
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onended = () => { setIsSpeaking(false); URL.revokeObjectURL(audioUrl); audioRef.current = null; };
      audio.onerror = () => { setIsSpeaking(false); URL.revokeObjectURL(audioUrl); audioRef.current = null; };
      await audio.play();
    } catch { setIsSpeaking(false); }
  }, [selectedVoice]);

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setIsSpeaking(false);
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;
      stopSpeaking();
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

        const enrichedContext = {
          ...context,
          currentPage: location.pathname,
        };

        const resp = await fetch(CHAT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ messages: allMsgs, context: enrichedContext }),
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
          const content = data.content || data.error || "Nessuna risposta";
          upsertAssistant(content);
          // Handle UI actions from JSON response
          const { uiActions } = parseStructuredMessage(content);
          if (uiActions.length > 0) handleUiActions(uiActions);
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

        // Check final message for UI actions
        const { uiActions } = parseStructuredMessage(assistantSoFar);
        if (uiActions.length > 0) handleUiActions(uiActions);
      } catch (e) {
        console.error("AI chat error:", e);
        upsertAssistant("⚠️ Errore di connessione. Riprova.");
      }

      setIsLoading(false);
    },
    [messages, isLoading, context, stopSpeaking, location.pathname, handleUiActions]
  );

  const toggleListening = useCallback(() => {
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.lang = "it-IT";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event: any) => { const transcript = event.results[0][0].transcript; if (transcript) sendMessage(transcript); };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening, sendMessage]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-4 pointer-events-none">
      <div className={`pointer-events-auto w-[440px] max-h-[85vh] flex flex-col rounded-2xl border shadow-2xl ${
        isDark ? "bg-slate-900/95 border-white/10 shadow-black/40" : "bg-white/95 border-slate-200 shadow-slate-300/50"
      } backdrop-blur-xl`}>
        {/* Header */}
        <div className={`flex items-center gap-3 px-4 py-3 border-b ${isDark ? "border-white/10" : "border-slate-200"}`}>
          <div className={`p-1.5 rounded-lg ${isDark ? "bg-violet-500/20" : "bg-violet-50"}`}>
            <Sparkles className={`w-4 h-4 ${isDark ? "text-violet-400" : "text-violet-500"}`} />
          </div>
          <div className="flex-1">
            <h3 className={`text-sm font-semibold ${th.h2}`}>Segretario Operativo AI</h3>
            <p className={`text-[10px] ${th.sub}`}>Memoria persistente • Piani di lavoro • Azioni UI</p>
          </div>
          {activePlans.length > 0 && (
            <ActivePlansBadge plans={activePlans} isDark={isDark} />
          )}
          {messages.length > 0 && (
            <button
              onClick={() => { setMessages([]); stopSpeaking(); lastSpokenIdxRef.current = -1; }}
              className={`p-1.5 rounded-lg transition-colors ${isDark ? "hover:bg-white/10 text-slate-500" : "hover:bg-slate-100 text-slate-400"}`}
              title="Nuova conversazione"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${isDark ? "hover:bg-white/10 text-slate-400" : "hover:bg-slate-100 text-slate-500"}`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-auto px-4 py-3 space-y-3 min-h-[200px] max-h-[60vh]">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-4 py-8">
              <Bot className={`w-12 h-12 ${isDark ? "text-white/10" : "text-slate-200"}`} />
              <p className={`text-xs text-center ${th.sub}`}>
                Sono il tuo segretario operativo.<br />Ho memoria, creo piani e agisco sul sistema.
              </p>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {quickPrompts.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors ${
                      isDark ? "border-white/10 text-slate-400 hover:bg-white/5 hover:text-slate-300" : "border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                    }`}
                  >
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
                  ? isDark ? "bg-violet-600/30 text-violet-100 border border-violet-500/20" : "bg-violet-50 text-violet-900 border border-violet-200"
                  : isDark ? "bg-white/5 text-slate-200 border border-white/5" : "bg-slate-50 text-slate-800 border border-slate-200"
              }`}>
                {msg.role === "assistant" ? (() => {
                  const parsed = parseAiAgentResponse<StructuredPartner>(msg.content);
                  return (
                    <>
                      <div className="prose prose-xs prose-slate dark:prose-invert max-w-none [&_table]:text-[10px] [&_th]:px-2 [&_td]:px-2 [&_p]:my-1 [&_li]:my-0.5 [&_ul]:my-1 [&_ol]:my-1 [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs">
                        <ReactMarkdown
                          components={{
                            a: ({ href, children }) => {
                              if (href?.startsWith("/")) {
                                return (
                                  <button className="text-violet-400 hover:text-violet-300 underline underline-offset-2 font-medium" onClick={() => { navigate(href!); onClose(); }}>
                                    {children}
                                  </button>
                                );
                              }
                              return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
                            }
                          }}
                        >{parsed.text}</ReactMarkdown>
                      </div>
                      {parsed.operations.length > 0 && <AiOperationCards operations={parsed.operations} />}
                      {parsed.partners.length > 0 && <AiResultsPanel partners={parsed.partners} />}
                    </>
                  );
                })() : msg.content}
              </div>
            </div>
          ))}

          {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex justify-start">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs ${
                isDark ? "bg-white/5 text-slate-400 border border-white/5" : "bg-slate-50 text-slate-500 border border-slate-200"
              }`}>
                <Loader2 className="w-3 h-3 animate-spin" />
                Sto analizzando...
              </div>
            </div>
          )}
        </div>

        {/* Voice controls bar */}
        <div className={`px-3 py-1.5 border-t flex items-center gap-2 ${isDark ? "border-white/5" : "border-slate-100"}`}>
          <button
            onClick={() => { setVoiceEnabled(!voiceEnabled); if (voiceEnabled) stopSpeaking(); }}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-medium transition-all ${
              voiceEnabled
                ? isSpeaking
                  ? isDark ? "bg-violet-500/20 text-violet-300 animate-pulse" : "bg-violet-100 text-violet-600 animate-pulse"
                  : isDark ? "bg-violet-500/15 text-violet-400" : "bg-violet-50 text-violet-500"
                : isDark ? "bg-white/5 text-slate-500 hover:text-slate-300" : "bg-slate-50 text-slate-400 hover:text-slate-600"
            }`}
            title={voiceEnabled ? "Disattiva voce" : "Attiva voce"}
          >
            {voiceEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
            {voiceEnabled ? "Voce ON" : "Voce OFF"}
          </button>

          {voiceEnabled && (
            <select
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value)}
              className={`text-[10px] rounded-lg px-2 py-1 outline-none ${
                isDark ? "bg-white/5 border border-white/10 text-slate-300" : "bg-slate-50 border border-slate-200 text-slate-600"
              }`}
            >
              {VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.lang} {v.name}
                </option>
              ))}
            </select>
          )}

          {isSpeaking && (
            <button
              onClick={stopSpeaking}
              className={`text-[10px] px-2 py-1 rounded-lg ${
                isDark ? "bg-red-500/15 text-red-400 hover:bg-red-500/25" : "bg-red-50 text-red-500 hover:bg-red-100"
              }`}
            >
              Stop
            </button>
          )}
        </div>

        {/* Input */}
        <div className={`px-3 py-2.5 border-t ${isDark ? "border-white/10" : "border-slate-200"}`}>
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
              }}
              placeholder="Chiedi qualcosa o dai un ordine operativo..."
              rows={1}
              className={`flex-1 resize-none rounded-xl px-3 py-2 text-xs outline-none transition-colors ${
                isDark
                  ? "bg-white/5 border border-white/10 text-white placeholder:text-slate-600 focus:border-violet-500/40"
                  : "bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-violet-400"
              }`}
              style={{ minHeight: "36px", maxHeight: "100px" }}
            />
            {hasSpeechAPI && (
              <button
                onClick={toggleListening}
                className={`p-2 rounded-xl transition-all ${
                  isListening
                    ? "bg-red-500/20 text-red-400 animate-pulse border border-red-500/30"
                    : isDark ? "bg-white/5 text-slate-500 hover:text-slate-300 hover:bg-white/10" : "bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                }`}
                title={isListening ? "Stop dettatura" : "Detta con microfono"}
              >
                {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              </button>
            )}
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              className={`p-2 rounded-xl transition-all ${
                input.trim() && !isLoading
                  ? isDark ? "bg-violet-600 hover:bg-violet-500 text-white" : "bg-violet-500 hover:bg-violet-600 text-white"
                  : isDark ? "bg-white/5 text-slate-600" : "bg-slate-100 text-slate-400"
              }`}
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
