import { useMemo, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { MicOff, Mic, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EmailType } from "@/data/defaultEmailTypes";
import { getCustomGoalPlaceholder } from "@/lib/oracleCoherence";

interface GoalInputProps {
  selectedType: EmailType | null;
  customGoal: string;
  coherence: { ok: boolean; warning?: string | null; suggestion?: string | null };
  onGoalChange: (text: string) => void;
  speech: {
    listening: boolean;
    hasSpeechAPI: boolean;
    interimText: string;
    toggle: () => void;
  };
}

export function OraclePanelGoalInput({
  selectedType,
  customGoal,
  coherence,
  onGoalChange,
  speech,
}: GoalInputProps) {
  const displayText = useMemo(() => {
    if (speech.listening) {
      return customGoal + (speech.interimText ? " " + speech.interimText : "");
    }
    return customGoal;
  }, [customGoal, speech.listening, speech.interimText]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Textarea
          value={displayText}
          onChange={(e) => onGoalChange(e.target.value)}
          placeholder={getCustomGoalPlaceholder(selectedType?.id ?? null)}
          className={cn(
            "text-xs min-h-[160px] max-h-[240px] resize-none pr-8",
            speech.listening && "ring-1 ring-destructive/40"
          )}
          rows={6}
        />
        {speech.hasSpeechAPI && (
          <button
            type="button"
            onClick={speech.toggle}
            className={cn(
              "absolute right-1.5 top-1.5 p-1 rounded-full transition-colors",
              speech.listening
                ? "bg-destructive/10 text-destructive animate-pulse"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
            title={
              speech.listening ? "Ferma registrazione" : "Dettatura vocale"
            }
          >
            {speech.listening ? (
              <MicOff className="w-3.5 h-3.5" />
            ) : (
              <Mic className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>

      {!coherence.ok && coherence.warning && (
        <div className="flex items-start gap-1.5 px-2 py-1.5 rounded-md bg-warning/10 border border-warning/30 text-[10px] text-warning-foreground/90">
          <Info className="w-3 h-3 shrink-0 mt-[1px] text-warning" />
          <div className="flex-1">
            <div className="text-foreground/90">{coherence.warning}</div>
            {coherence.suggestion && (
              <div className="text-muted-foreground mt-0.5">
                {coherence.suggestion}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
