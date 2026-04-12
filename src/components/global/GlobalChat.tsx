import { Bot, Send, Loader2, Sparkles, Plus, Mic, MicOff, MessageSquare, Zap, Volume2 } from "lucide-react";
import { AiResultsPanel, type StructuredPartner } from "@/components/operations/AiResultsPanel";
import { LiveOperationCards } from "@/components/ai/LiveOperationCards";
import AIMarkdown from "@/components/intelliflow/AIMarkdown";
import { parseAiAgentResponse, type JobCreatedInfo } from "@/lib/ai/agentResponse";
import { useGlobalChat } from "@/hooks/useGlobalChat";

const QUICK_PROMPTS = [
  "Scarica tutti i partner",
  "Scarica partner USA",
  "Aggiorna profili mancanti",
  "Stato download attivi",
];

interface GlobalChatProps {
  onJobCreated?: (job: JobCreatedInfo) => void;
}

export function GlobalChat({ onJobCreated }: GlobalChatProps) {
  const {
    messages, state, scrollRef, inputRef, speech,
    sendMessage, handleReplay, newConversation, setInput, setMode,
  } = useGlobalChat({ onJobCreated });

  const renderAssistantMessage = (content: string, idx: number) => {
    const parsed = parseAiAgentResponse<StructuredPartner>(content);
    return (
      <>
        <div className="prose prose-xs prose-invert max-w-none [&_table]:text-[10px] [&_th]:px-2 [&_td]:px-2 [&_p]:my-1 [&_li]:my-0.5">
          <AIMarkdown content={parsed.text} />
        </div>
        {parsed.operations.length > 0 && <LiveOperationCards operations={parsed.operations} />}
        {parsed.partners.length > 0 && <AiResultsPanel partners={parsed.partners} />}
        <button onClick={() => handleReplay(content, idx)} disabled={state.playingIdx !== null}
          className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors" aria-label="Riascolta messaggio">
          {state.playingIdx === idx ? <Loader2 className="w-3 h-3 animate-spin" /> : <Volume2 className="w-3 h-3" />}
          <span>{state.playingIdx === idx ? "Riproduzione..." : "Ascolta"}</span>
        </button>
      </>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <div className="p-1.5 rounded-lg bg-primary/20"><Sparkles className="w-4 h-4 text-primary" /></div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-foreground">Assistente AI</h3>
          <p className="text-[10px] text-muted-foreground">Operativo & Strategico</p>
        </div>
        <div className="flex items-center gap-0.5 bg-secondary/50 rounded-lg p-0.5 text-[10px]">
          <button onClick={() => setMode("operational")} aria-label="Modalità operativa"
            className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all ${state.mode === "operational" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <Zap className="w-3 h-3" /> Operativo
          </button>
          <button onClick={() => setMode("conversational")} aria-label="Modalità strategica"
            className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all ${state.mode === "conversational" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <MessageSquare className="w-3 h-3" /> Strategico
          </button>
        </div>
        {messages.length > 0 && (
          <button onClick={newConversation} className="p-1.5 rounded-lg transition-colors hover:bg-secondary/50 text-muted-foreground" title="Nuova conversazione" aria-label="Nuova conversazione">
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 py-8">
            <Bot className="w-12 h-12 text-muted-foreground/20" />
            <p className="text-xs text-center text-muted-foreground">Chiedi di scaricare partner per paese,<br />aggiornare profili o verificare lo stato.</p>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {QUICK_PROMPTS.map((q) => (
                <button key={q} onClick={() => sendMessage(q)} className="text-[10px] px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-colors">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${msg.role === "user" ? "bg-primary/20 text-foreground border border-primary/20" : "bg-muted/30 text-foreground border border-border/30"}`}>
              {msg.role === "assistant" ? renderAssistantMessage(msg.content, i) : msg.content}
            </div>
          </div>
        ))}
        {state.isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs bg-muted/30 text-muted-foreground border border-border/30">
              <Loader2 className="w-3 h-3 animate-spin" />Sto analizzando...
            </div>
          </div>
        )}
      </div>

      <div className="px-3 py-2.5 border-t border-border">
        <div className="flex items-end gap-2">
          <textarea ref={inputRef} value={state.input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(state.input); } }}
            placeholder="Es: Scarica tutti i partner della Germania..." rows={1} aria-label="Messaggio per l'assistente AI"
            className="flex-1 resize-none rounded-xl px-3 py-2 text-xs outline-none transition-colors bg-muted/30 border border-border text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40"
            style={{ minHeight: "36px", maxHeight: "100px" }} />
          {speech.hasSpeechAPI && (
            <button onClick={speech.toggle} aria-label={speech.listening ? "Stop dettatura" : "Detta con microfono"}
              className={`p-2 rounded-xl transition-all ${speech.listening ? "bg-destructive/20 text-destructive animate-pulse border border-destructive/30" : "bg-secondary/30 text-muted-foreground hover:text-foreground hover:bg-secondary/50"}`}>
              {speech.listening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            </button>
          )}
          <button onClick={() => sendMessage(state.input)} disabled={!state.input.trim() || state.isLoading} aria-label="Invia messaggio"
            className={`p-2 rounded-xl transition-all ${state.input.trim() && !state.isLoading ? "bg-primary hover:bg-primary/90 text-primary-foreground" : "bg-muted/30 text-muted-foreground"}`}>
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
