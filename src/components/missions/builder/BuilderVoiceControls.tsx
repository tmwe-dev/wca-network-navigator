import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Mic, MicOff } from "lucide-react";
import type { RefObject } from "react";

interface BuilderVoiceControlsProps {
  chatInput: string;
  onChatInputChange: (v: string) => void;
  onSend: (text: string) => void;
  isChatLoading: boolean;
  chatInputRef: RefObject<HTMLTextAreaElement>;
  speech: { listening: boolean; hasSpeechAPI: boolean; toggle: () => void; interimText: string };
}

export function BuilderVoiceControls({
  chatInput, onChatInputChange, onSend, isChatLoading, chatInputRef, speech,
}: BuilderVoiceControlsProps) {
  return (
    <div className="px-4 py-3 border-t border-border max-w-2xl mx-auto w-full">
      {speech.listening && speech.interimText && (
        <div className="text-xs text-primary mb-2 animate-pulse truncate">🎙 {speech.interimText}</div>
      )}
      <div className="flex gap-2">
        {speech.hasSpeechAPI && (
          <Button size="icon" variant={speech.listening ? "default" : "outline"} onClick={speech.toggle}
            className={`flex-shrink-0 ${speech.listening ? "animate-pulse" : ""}`} aria-label={speech.listening ? "Stop dettatura" : "Dettatura vocale"}>
            {speech.listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </Button>
        )}
        <Textarea ref={chatInputRef} value={chatInput} onChange={e => onChatInputChange(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(chatInput); } }}
          placeholder={speech.listening ? "🎙 Sto ascoltando…" : "Descrivi la tua missione..."}
          className="min-h-[40px] max-h-[80px] resize-none text-sm" rows={1} />
        <Button size="icon" onClick={() = aria-label="Invia"> onSend(chatInput)} disabled={isChatLoading || !chatInput.trim()} className="flex-shrink-0" aria-label="Invia">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
