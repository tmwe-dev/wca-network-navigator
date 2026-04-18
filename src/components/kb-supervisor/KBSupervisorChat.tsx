/**
 * KBSupervisorChat — Pannello chat (sinistro) con voce + testo
 */
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, Volume2, VolumeX, Send, Loader2, FileText } from "lucide-react";
import type { SupervisorMessage } from "@/v2/ui/pages/kb-supervisor/hooks/useKBSupervisorState";
import { cn } from "@/lib/utils";

interface Props {
  readonly messages: readonly SupervisorMessage[];
  readonly onSendMessage: (text: string) => void;
  readonly isLoading: boolean;
  readonly voiceEnabled: boolean;
  readonly onToggleVoice: () => void;
  readonly isListening: boolean;
  readonly isSpeaking: boolean;
  readonly onStartListening: () => void;
  readonly onStopListening: () => void;
}

const SUGGESTIONS = [
  "Analizza la KB e trova i problemi",
  "Mostrami i documenti Robin",
  "Migliora il documento sul cold outreach",
  "Crea un nuovo documento per la gestione contatti tedeschi",
];

export function KBSupervisorChat({
  messages, onSendMessage, isLoading,
  voiceEnabled, onToggleVoice,
  isListening, isSpeaking,
  onStartListening, onStopListening,
}: Props) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-8 px-4">
              <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-semibold text-foreground">KB Supervisor</h3>
              <p className="text-sm text-muted-foreground mt-2 mb-4">
                Parla o scrivi per analizzare, modificare e migliorare la Knowledge Base.
              </p>
              <div className="space-y-1.5 text-left max-w-sm mx-auto">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => onSendMessage(s)}
                    className="block w-full text-xs px-3 py-2 rounded-md bg-muted hover:bg-accent text-muted-foreground hover:text-accent-foreground transition-colors"
                  >
                    "{s}"
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "rounded-lg p-3 text-sm",
                msg.role === "user"
                  ? "bg-primary/10 text-foreground ml-8"
                  : "bg-muted text-foreground mr-8",
              )}
            >
              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              {msg.proposedAction && (
                <Badge variant="outline" className="mt-2 text-[10px]">
                  {msg.proposedAction.type}: {msg.proposedAction.status}
                </Badge>
              )}
              <p className="text-[10px] text-muted-foreground mt-1.5">
                {msg.timestamp.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          ))}

          {isLoading && (
            <div className="bg-muted rounded-lg p-3 mr-8 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Sto ragionando...</span>
            </div>
          )}

          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <div className="border-t border-border p-3 space-y-2 bg-card">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant={isListening ? "destructive" : "outline"}
            onClick={isListening ? onStopListening : onStartListening}
            className="gap-1.5"
          >
            {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            {isListening ? "Stop" : "Parla"}
          </Button>

          <Button
            size="sm"
            variant={voiceEnabled ? "default" : "outline"}
            onClick={onToggleVoice}
            className="gap-1.5"
          >
            {voiceEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            {voiceEnabled ? "Audio ON" : "Audio OFF"}
          </Button>

          {isListening && (
            <Badge variant="secondary" className="text-[10px] animate-pulse">Ascolto in corso...</Badge>
          )}
          {isSpeaking && (
            <Badge variant="secondary" className="text-[10px] animate-pulse">Parlando...</Badge>
          )}
        </div>

        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Scrivi o usa il microfono..."
            className="min-h-[60px] max-h-[120px] resize-none text-sm"
            disabled={isLoading}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="self-end"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
