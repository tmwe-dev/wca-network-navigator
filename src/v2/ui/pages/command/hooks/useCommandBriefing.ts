/**
 * useCommandBriefing — opening briefing for Command.
 *
 * Aggregates real-time signals (unread emails, proposed agent tasks, pending
 * approvals, draft emails, scheduled outreach, active jobs) into:
 *  - a short Italian summary suitable for TTS
 *  - prioritized action chips with ready-to-send prompts
 *
 * Logic-only hook: no UI, no side effects. Used by `BriefingPanel` and
 * (optionally) by the assistant for the spoken opening.
 */
import { useMemo } from "react";
import { useSmartSuggestions, type SmartSuggestion } from "@/v2/hooks/useSmartSuggestions";

export interface BriefingChip {
  readonly id: string;
  readonly icon: string;
  readonly label: string;
  readonly prompt: string;
  readonly count: number;
}

export interface CommandBriefing {
  readonly loading: boolean;
  readonly summary: string;
  readonly chips: readonly BriefingChip[];
  readonly hasSignals: boolean;
}

function suggestionToPrompt(s: SmartSuggestion): string {
  switch (s.id) {
    case "unread-emails": return "Analizza le email in arrivo e dimmi quali richiedono azione immediata.";
    case "proposed-tasks": return "Mostrami i task proposti dagli agenti e aiutami a decidere quali approvare.";
    case "pending-approval": return "Mostra le azioni in attesa di autorizzazione e proponi un ordine di revisione.";
    case "draft-emails": return "Mostra le bozze email da rivedere e suggerisci miglioramenti.";
    case "pending-outreach": return "Mostra gli outreach programmati e segnala anomalie.";
    case "active-jobs": return "Riassumi lo stato dei job attivi e segnala blocchi.";
    default: return s.label;
  }
}

function buildSummary(chips: readonly BriefingChip[]): string {
  if (chips.length === 0) {
    return "Tutto sotto controllo. Nessun segnale urgente: posso aiutarti a pianificare la prossima mossa.";
  }
  const parts = chips.slice(0, 3).map((c) => c.label.toLowerCase());
  return `Buongiorno. Ho ${parts.join(", ")}. Da dove vuoi partire?`;
}

export function useCommandBriefing(): CommandBriefing {
  const { data: suggestions = [], isLoading } = useSmartSuggestions();

  return useMemo(() => {
    const chips: BriefingChip[] = suggestions
      .filter((s) => s.count > 0)
      .map((s) => ({
        id: s.id,
        icon: s.icon,
        label: s.label,
        prompt: suggestionToPrompt(s),
        count: s.count,
      }));
    return {
      loading: isLoading,
      summary: buildSummary(chips),
      chips,
      hasSignals: chips.length > 0,
    };
  }, [suggestions, isLoading]);
}