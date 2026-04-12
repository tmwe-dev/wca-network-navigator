import { useContext, useEffect } from "react";
import { Bot, Send, X, Loader2, Sparkles, Trash2, Rocket, Clock, Mic, MicOff, ListChecks } from "lucide-react";
import { ThemeCtx, t } from "@/components/download/theme";
import { LazyMarkdown as ReactMarkdown } from "@/components/ui/lazy-markdown";
import { useNavigate } from "react-router-dom";
import { AiResultsPanel, type StructuredPartner } from "./AiResultsPanel";
import { LiveOperationCards } from "@/components/ai/LiveOperationCards";
import { toast } from "@/hooks/use-toast";
import { ActivePlansBadge } from "./ai/ActivePlansBadge";
import { parseAiAgentResponse } from "@/lib/ai/agentResponse";
import { useAiAssistantChat, type JobCreatedInfo } from "@/hooks/useAiAssistantChat";
import { useAiVoice, VOICES } from "@/hooks/useAiVoice";

const PAGE_QUICK_PROMPTS: Record<string, string[]> = {
  default: ["Riepilogo globale del database", "Paesi con più profili mancanti", "Job attivi in questo momento", "Partner con rating più alto"],
  "/partner-hub": ["Mostra partner per rating", "Paesi con gap nella directory", "Partner senza email", "Verifica blacklist"],
  "/contacts": ["Contatti importati per origine", "Contatti senza email", "Statistiche per paese", "Contatti più recenti"],
  "/import": ["Ultimo import effettuato", "Errori di importazione", "Contatti da trasferire", "Statistiche import"],
  "/workspace": ["Genera email di presentazione", "Partner con email per campagna", "Top partner per servizi", "Template disponibili"],
};

function JobCreatedBadge({ job, isDark }: { job: JobCreatedInfo; isDark: boolean }) {
  useEffect(() => {
    toast({ title: "🚀 Download avviato dall'AI", description: `${job.country} — ${job.total_partners} partner (${job.mode}). ~${job.estimated_time_minutes} min` });
  }, [job.job_id]);

  return (
    <div className={`mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-medium animate-pulse ${isDark ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300" : "bg-emerald-50 border border-emerald-200 text-emerald-700"}`}>
      <Rocket className="w-3.5 h-3.5 shrink-0" />
      <span className="flex-1">Job creato per <strong>{job.country}</strong> — {job.total_partners} partner</span>
      <span className="flex items-center gap-1 opacity-70"><Clock className="w-3 h-3" />~{job.estimated_time_minutes} min</span>
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  context?: { selectedCountries: { code: string; name: string }[]; filterMode: string };
}

export function AiAssistantDialog({ open, onClose, context }: Props) {
  const isDark = useContext(ThemeCtx);
  const th = t(isDark);
  const navigate = useNavigate();

  const chat = useAiAssistantChat({ open, onClose, context });
  const voice = useAiVoice(chat.messages, chat.isLoading);

  const quickPrompts = PAGE_QUICK_PROMPTS[chat.currentPage] || PAGE_QUICK_PROMPTS.default;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-4 pointer-events-none">
      <div className={`pointer-events-auto w-[440px] max-h-[85vh] flex flex-col rounded-2xl border shadow-2xl ${isDark ? "bg-card/95 border-border shadow-black/40" : "bg-card/95 border-border shadow-lg"} backdrop-blur-xl`}>
        {/* Header */}
        <div className={`flex items-center gap-3 px-4 py-3 border-b border-border`}>
          <div className={`p-1.5 rounded-lg bg-primary/10`}>
            <Sparkles className={`w-4 h-4 text-primary`} />
          </div>
          <div className="flex-1">
            <h3 className={`text-sm font-semibold ${th.h2}`}>Segretario Operativo AI</h3>
            <p className={`text-[10px] ${th.sub}`}>Memoria persistente • Piani di lavoro • Azioni UI</p>
          </div>
          {chat.activePlans.length > 0 && <ActivePlansBadge plans={chat.activePlans} isDark={isDark} />}
          {chat.messages.length > 0 && (
            <button onClick={() => { chat.clearMessages(); voice.stopSpeaking(); voice.resetSpoken(); }}
              className={`p-1.5 rounded-lg transition-colors hover:bg-muted text-muted-foreground`} title="Nuova conversazione">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={onClose} className={`p-1.5 rounded-lg transition-colors hover:bg-muted text-muted-foreground`}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages */}
        <div ref={chat.scrollRef} className="flex-1 overflow-auto px-4 py-3 space-y-3 min-h-[200px] max-h-[60vh]">
          {chat.messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-4 py-8">
              <Bot className={`w-12 h-12 text-muted-foreground/20`} />
              <p className={`text-xs text-center ${th.sub}`}>Sono il tuo segretario operativo.<br />Ho memoria, creo piani e agisco sul sistema.</p>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {quickPrompts.map(q => (
                  <button key={q} onClick={() => { voice.stopSpeaking(); chat.sendMessage(q); }}
                    className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors border-border text-muted-foreground hover:bg-muted`}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {chat.messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary/10 text-foreground border border-primary/20"
                  : "bg-muted/30 text-foreground border border-border"
              }`}>
                {msg.role === "assistant" ? (() => {
                  const parsed = parseAiAgentResponse<StructuredPartner>(msg.content);
                  return (
                    <>
                      <div className="prose prose-xs prose-slate dark:prose-invert max-w-none [&_table]:text-[10px] [&_th]:px-2 [&_td]:px-2 [&_p]:my-1">
                        <ReactMarkdown components={{
                          a: ({ href, children }) => href?.startsWith("/")
                            ? <button className="text-primary hover:text-primary/80 underline underline-offset-2 font-medium" onClick={() => { navigate(href!); onClose(); }}>{children}</button>
                            : <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
                        }}>{parsed.text}</ReactMarkdown>
                      </div>
                      {parsed.operations.length > 0 && <LiveOperationCards operations={parsed.operations} />}
                      {parsed.partners.length > 0 && <AiResultsPanel partners={parsed.partners} />}
                    </>
                  );
                })() : msg.content}
              </div>
            </div>
          ))}

          {chat.isLoading && chat.messages[chat.messages.length - 1]?.role !== "assistant" && (
            <div className="flex justify-start">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs bg-muted/30 text-muted-foreground border border-border`}>
                <Loader2 className="w-3 h-3 animate-spin" /> Sto analizzando...
              </div>
            </div>
          )}
        </div>

        {/* Voice bar */}
        <div className={`px-3 py-1.5 border-t flex items-center gap-2 border-border`}>
          <button onClick={() => { voice.setVoiceEnabled(!voice.voiceEnabled); if (voice.voiceEnabled) voice.stopSpeaking(); }}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-medium transition-all ${
              voice.voiceEnabled ? "bg-primary/10 text-primary border border-primary/30"
                : "bg-muted text-muted-foreground border border-border"
            }`}>
            🔊 {voice.voiceEnabled ? "On" : "Off"}
          </button>
          {voice.voiceEnabled && (
            <select value={voice.selectedVoice} onChange={e => voice.setSelectedVoice(e.target.value)}
              className={`text-[10px] rounded-lg px-2 py-1 border bg-card border-border text-foreground`}>
              {VOICES.map(v => <option key={v.id} value={v.id}>{v.lang} {v.name}</option>)}
            </select>
          )}
        </div>

        {/* Input */}
        <div className={`px-3 py-2 border-t border-border`}>
          <div className="flex items-end gap-2">
            <textarea ref={chat.inputRef} rows={1} value={chat.input} onChange={e => chat.setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); voice.stopSpeaking(); chat.sendMessage(chat.input); } }}
              placeholder="Scrivi un messaggio..."
              className={`flex-1 resize-none rounded-xl px-3 py-2 text-xs border transition-colors bg-card border-border text-foreground placeholder:text-muted-foreground focus:border-primary/50 outline-none`} />
            {voice.hasSpeechAPI && (
              <button onClick={() => voice.toggleListening((text) => { voice.stopSpeaking(); chat.sendMessage(text); })}
                className={`p-2 rounded-xl transition-colors ${voice.isListening ? "bg-destructive/20 text-destructive" : "hover:bg-muted text-muted-foreground"}`}>
                {voice.isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            )}
            <button onClick={() => { voice.stopSpeaking(); chat.sendMessage(chat.input); }} disabled={!chat.input.trim() || chat.isLoading}
              className={`p-2 rounded-xl transition-colors bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30`}>
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
