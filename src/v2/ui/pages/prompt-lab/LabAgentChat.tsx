/**
 * LabAgentChat — Footer chat con Lab Agent.
 */
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Sparkles, Trash2, Wrench } from "lucide-react";
import type { LabChatMessage } from "./hooks/useLabAgent";

interface LabAgentChatProps {
  messages: ReadonlyArray<LabChatMessage>;
  loading: boolean;
  onSend: (text: string) => void;
  onClear: () => void;
  placeholder?: string;
  /** Modalità corrente del Lab Agent (Fase 4-5). */
  mode?: "standard" | "architect";
  /** Callback per cambiare modalità. Se omesso, il toggle non è mostrato. */
  onModeChange?: (mode: "standard" | "architect") => void;
}

export function LabAgentChat({ messages, loading, onSend, onClear, placeholder, mode, onModeChange }: LabAgentChatProps) {
  const [input, setInput] = React.useState("");
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  function handleSubmit() {
    const v = input.trim();
    if (!v || loading) return;
    onSend(v);
    setInput("");
  }

  return (
    <div className="flex h-full flex-col bg-muted/30 border-t">
      <div className="flex items-center justify-between px-3 py-1.5 border-b bg-background">
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Lab Agent — Prompt Architect
          {mode === "architect" && (
            <span className="ml-1 rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-foreground">
              ARCHITECT
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onModeChange && (
            <Button
              size="sm"
              variant={mode === "architect" ? "default" : "ghost"}
              className="h-6 px-2 text-[10px]"
              onClick={() => onModeChange(mode === "architect" ? "standard" : "architect")}
              title={
                mode === "architect"
                  ? "Torna a modalità Standard (riscrittura)"
                  : "Passa a modalità Architect (diagnosi strutturale)"
              }
            >
              <Wrench className="mr-1 h-3 w-3" />
              {mode === "architect" ? "Architect" : "Standard"}
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-6 px-2" onClick={onClear}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto px-3 py-2 space-y-2">
        {messages.length === 0 && (
          <p className="text-xs text-muted-foreground italic">
            Esempio: "migliora il blocco Golden Rules rendendolo più conciso", "rivedi tutti i blocchi del tab attivo".
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`text-xs rounded-md px-2 py-1.5 ${
              m.role === "user"
                ? "bg-primary/10 ml-12"
                : "bg-background border mr-12"
            }`}
          >
            <div className="font-medium text-[10px] text-muted-foreground mb-0.5">
              {m.role === "user" ? "Tu" : "Lab Agent"}
            </div>
            <div className="whitespace-pre-wrap">{m.content}</div>
          </div>
        ))}
        {loading && (
          <div className="text-xs text-muted-foreground italic">Lab Agent sta pensando...</div>
        )}
      </div>

      <div className="flex items-end gap-2 p-2 border-t bg-background">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder ?? "Scrivi al Lab Agent..."}
          className="min-h-[40px] max-h-[80px] text-xs resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
        <Button size="sm" disabled={loading || !input.trim()} onClick={handleSubmit}>
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}