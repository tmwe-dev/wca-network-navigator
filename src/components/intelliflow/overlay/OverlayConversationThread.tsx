import { Bot, Volume2 } from "lucide-react";
import AiEntity from "../AiEntity";
import AIMarkdown from "../AIMarkdown";
import { parseAiAgentResponse } from "@/lib/ai/agentResponse";
import { LiveOperationCards } from "@/components/ai/LiveOperationCards";
import type { StructuredPartner } from "@/components/operations/AiResultsPanel";
import type { ConversationMessage } from "@/hooks/useAIConversation";
import type { RefObject } from "react";
import { Loader2 } from "lucide-react";

interface OverlayConversationThreadProps {
  messages: ConversationMessage[];
  loading: boolean;
  chatEndRef: RefObject<HTMLDivElement>;
}

export function OverlayConversationThread({ messages, loading, chatEndRef }: OverlayConversationThreadProps) {
  return (
    <div className="flex-1 overflow-y-auto px-8 py-6">
      <div className="max-w-2xl mx-auto space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex items-start gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
            {msg.role === "assistant" && (
              <div className="flex-shrink-0 mt-1"><AiEntity size="sm" pulse={false} /></div>
            )}
            <div className={`max-w-[85%] px-5 py-4 rounded-2xl border border-border/70 ${
              msg.role === "user" ? "rounded-br-lg bg-secondary/60" : "rounded-bl-lg bg-card/80"
            }`}>
              {msg.role === "assistant" && (
                <div className="flex items-center gap-1.5 mb-2 text-[10px] text-primary font-mono tracking-[0.2em] uppercase font-semibold">
                  <Bot className="w-3 h-3" />Segretario Operativo
                  <button
                    onClick={() => {
                      const text = msg.content.slice(0, 3000);
                      fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
                        body: JSON.stringify({ text, voiceId: "FGY2WhTYpPnrIDTdsKH5" }),
                      }).then(r => r.ok ? r.blob() : null).then(b => b && new Audio(URL.createObjectURL(b)).play()).catch(() => {});
                    }}
                    className="ml-auto text-muted-foreground hover:text-foreground transition-colors p-0.5"
                    title="Ascolta risposta"
                  >
                    <Volume2 className="w-3 h-3" />
                  </button>
                </div>
              )}
              <div className="ai-prose max-w-none">
                {msg.role === "assistant" ? (() => {
                  const parsed = parseAiAgentResponse<StructuredPartner>(msg.content);
                  return (
                    <>
                      <AIMarkdown content={parsed.text} />
                      {parsed.operations.length > 0 && <LiveOperationCards operations={parsed.operations} />}
                    </>
                  );
                })() : <AIMarkdown content={msg.content} />}
              </div>
              {msg.timestamp && <span className="text-[10px] text-muted-foreground mt-2 block">{msg.timestamp}</span>}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-1"><AiEntity size="sm" /></div>
            <div className="flex items-center gap-2 px-5 py-4">
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
              <span className="text-xs text-muted-foreground">Elaborazione in corso…</span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>
    </div>
  );
}
