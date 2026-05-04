/**
 * AiSuggestionChip — slot riservato al suggerimento AI per indirizzo/cartella.
 *
 * Visibile sempre nella card mail. Quando arriverà un `aiSuggestion` dal
 * classificatore, mostra il chip cliccabile. Per ora mostra placeholder neutro.
 */
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AiSuggestion {
  label: string;
  color?: string | null;
  icon?: string | null;
  reason?: string | null;
}

interface Props {
  suggestion?: AiSuggestion | null;
  onAccept?: () => void;
  className?: string;
}

export function AiSuggestionChip({ suggestion, onAccept, className }: Props) {
  if (!suggestion) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-sm px-1.5 py-0 text-[9px] font-medium leading-tight text-muted-foreground/60",
          className,
        )}
        title="Nessun suggerimento AI disponibile"
      >
        <Sparkles className="h-2.5 w-2.5" />
        <span>—</span>
      </span>
    );
  }

  const color = suggestion.color ?? "#8B5CF6";
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onAccept?.();
      }}
      className={cn(
        "inline-flex items-center gap-1 rounded-sm px-1.5 py-0 text-[9px] font-medium leading-tight transition-opacity hover:opacity-80",
        className,
      )}
      style={{
        backgroundColor: `${color}22`,
        color,
        border: `1px dashed ${color}66`,
      }}
      title={suggestion.reason ? `AI suggerisce: ${suggestion.label} — ${suggestion.reason}` : `AI suggerisce: ${suggestion.label}`}
    >
      <Sparkles className="h-2.5 w-2.5" />
      {suggestion.icon && <span>{suggestion.icon}</span>}
      <span className="truncate max-w-[140px]">AI: {suggestion.label}</span>
    </button>
  );
}
