/**
 * SignalsBanner — mostra segnalazioni dal feedback loop nel Prompt Lab.
 *
 * LOVABLE-92: Il banner appare nella fase idle del GlobalImproverDialog
 * o nella PromptLabPage header. Mostra quante anomalie sono state rilevate
 * e permette di espandere la lista con dettagli + suggerimenti.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ChevronDown, ChevronUp, X, Loader2, Bell } from "lucide-react";
import type { SignalsState } from "./hooks/usePromptLabSignals";
import type { PromptLabSignal } from "@/data/promptLabSignals";

interface SignalsBannerProps {
  state: SignalsState;
  onAnalyze: () => void;
  onDismiss: (id: string) => void;
  onAcknowledge: (id: string) => void;
  /** Callback per copiare il suggerimento nel campo materiale di riferimento */
  onCopySuggestion?: (text: string) => void;
}

function severityColor(severity: PromptLabSignal["severity"]) {
  switch (severity) {
    case "critical": return "bg-destructive/10 border-destructive/40 text-destructive";
    case "warning": return "bg-amber-500/10 border-amber-500/40 text-amber-700";
    default: return "bg-blue-500/10 border-blue-500/40 text-blue-700";
  }
}

function severityBadge(severity: PromptLabSignal["severity"]) {
  switch (severity) {
    case "critical": return "destructive" as const;
    case "warning": return "secondary" as const;
    default: return "outline" as const;
  }
}

export function SignalsBanner({ state, onAnalyze, onDismiss, onAcknowledge, onCopySuggestion }: SignalsBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const activeSignals = state.signals.filter((s) => s.status === "new" || s.status === "acknowledged");

  // Compact badge (when no analysis done yet but badge count > 0)
  if (state.signals.length === 0 && state.badgeCount > 0) {
    return (
      <div className="rounded border border-amber-500/40 bg-amber-500/5 p-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs">
          <Bell className="h-3.5 w-3.5 text-amber-600" />
          <span className="text-amber-700 font-medium">
            Possibili anomalie rilevate nei log ({state.badgeCount} segnali)
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-6 text-[10px] gap-1"
          onClick={onAnalyze}
          disabled={state.loading}
        >
          {state.loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <AlertTriangle className="h-3 w-3" />}
          Analizza
        </Button>
      </div>
    );
  }

  // No signals at all
  if (state.signals.length === 0) return null;

  // All dismissed
  if (activeSignals.length === 0) return null;

  return (
    <div className="rounded border border-amber-500/40 bg-amber-500/5 p-2.5 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
          <span className="text-amber-700 font-medium">
            {activeSignals.length} segnalazione{activeSignals.length > 1 ? "i" : ""} dal sistema
          </span>
          {activeSignals.some((s) => s.severity === "critical") && (
            <Badge variant="destructive" className="text-[9px] h-4">Critica</Badge>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {expanded && (
        <div className="space-y-2 pt-1">
          {activeSignals.map((signal) => (
            <div
              key={signal.id}
              className={`rounded border p-2.5 text-xs ${severityColor(signal.severity)}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Badge variant={severityBadge(signal.severity)} className="text-[9px] h-4">
                      {signal.type.replace(/_/g, " ")}
                    </Badge>
                    <span className="font-medium">{signal.title}</span>
                  </div>
                  <p className="text-[11px] opacity-80 mb-1.5">{signal.description}</p>
                  <p className="text-[11px] font-medium opacity-90">
                    Suggerimento: {signal.suggested_action}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {onCopySuggestion && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-5 text-[9px] px-1.5"
                      onClick={() => onCopySuggestion(
                        `[Segnalazione ${signal.type}] ${signal.title}\n${signal.description}\nSuggerimento: ${signal.suggested_action}`
                      )}
                    >
                      Copia
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-5 w-5 p-0"
                    onClick={() => onDismiss(signal.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
