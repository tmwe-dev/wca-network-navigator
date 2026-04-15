/**
 * AgentTimeline — Shows agent loop steps with status icons.
 */
import { motion } from "framer-motion";
import { Bot, CheckCircle, XCircle, Loader2, ShieldAlert, Square } from "lucide-react";
import type { AgentState } from "@/v2/agent/runtime/agentLoop";

interface Props {
  state: AgentState;
  onStop: () => void;
  onApprove: () => void;
  onReject: () => void;
  autonomousMode: boolean;
  onToggleAutonomous: (v: boolean) => void;
}

const TOOL_ICONS: Record<string, string> = {
  navigate: "🧭",
  read_page: "👁",
  click: "👆",
  type_text: "⌨️",
  read_dom: "📄",
  list_kb: "📚",
  read_kb: "📖",
  scrape_url: "🕸",
  ask_user: "❓",
  finish: "✅",
};

export default function AgentTimeline({ state, onStop, onApprove, onReject, autonomousMode, onToggleAutonomous }: Props) {
  if (!state.running && state.transcript.length === 0) return null;

  const waitingApproval = state.running && state.transcript.some(
    (s) => !s.result.success && s.result.error === "Azione annullata dall'utente"
  );

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="w-80 border-l border-border/30 bg-background/50 backdrop-blur-xl flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Missione</span>
          <span className="text-xs text-muted-foreground">{state.step}/80</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggleAutonomous(!autonomousMode)}
            className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
              autonomousMode ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
            }`}
          >
            {autonomousMode ? "Auto" : "Step"}
          </button>
          {state.running && (
            <button onClick={onStop} className="text-xs text-destructive hover:text-destructive/80 flex items-center gap-1">
              <Square className="w-3 h-3" /> Stop
            </button>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5">
        {state.transcript.map((step, i) => (
          <div
            key={i}
            className="flex items-start gap-2 text-xs py-1"
          >
            <span className="flex-shrink-0 w-5 text-center">{TOOL_ICONS[step.toolName] ?? "🔧"}</span>
            <div className="flex-1 min-w-0">
              <span className="font-medium text-foreground/90">{step.toolName}</span>
              {step.args && Object.keys(step.args).length > 0 && (
                <span className="text-muted-foreground ml-1 truncate block">
                  {JSON.stringify(step.args).slice(0, 60)}
                </span>
              )}
              {/* Screenshot thumbnail for browser-action results */}
              {step.result.success && step.result.data && typeof step.result.data === "object" && "finalScreenshot" in (step.result.data as Record<string, unknown>) && (
                <button
                  onClick={() => {
                    const ss = (step.result.data as Record<string, string>).finalScreenshot;
                    if (ss) window.open(`data:image/jpeg;base64,${ss}`, "_blank");
                  }}
                  className="mt-1 block rounded overflow-hidden border border-border/30 hover:border-primary/50 transition-colors"
                >
                  <img
                    src={`data:image/jpeg;base64,${(step.result.data as Record<string, string>).finalScreenshot}`}
                    alt="Screenshot"
                    className="w-full max-w-[200px] h-auto"
                  />
                </button>
              )}
            </div>
            <span className="flex-shrink-0">
              {step.result.success ? (
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-destructive" />
              )}
            </span>
          </div>
        ))}

        {state.running && (
          <div className="flex items-center gap-2 text-xs py-1 text-primary">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>In esecuzione...</span>
          </div>
        )}
      </div>

      {/* Approval bar */}
      {state.running && !autonomousMode && (
        <div className="px-4 py-2 border-t border-border/20 flex gap-2">
          <button
            onClick={onApprove}
            className="flex-1 text-xs py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            Approva
          </button>
          <button
            onClick={onReject}
            className="flex-1 text-xs py-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
          >
            Rifiuta
          </button>
        </div>
      )}

      {/* Final answer */}
      {state.finished && state.finalAnswer && (
        <div className="px-4 py-3 border-t border-border/20">
          <p className="text-xs text-muted-foreground mb-1">Risultato:</p>
          <p className="text-sm text-foreground/90">{state.finalAnswer.slice(0, 300)}</p>
        </div>
      )}

      {/* Error */}
      {state.error && (
        <div className="px-4 py-2 border-t border-destructive/30 flex items-center gap-2">
          <ShieldAlert className="w-3.5 h-3.5 text-destructive" />
          <span className="text-xs text-destructive">{state.error}</span>
        </div>
      )}
    </motion.div>
  );
}
