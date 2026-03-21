import { Bot, Loader2, RefreshCw, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import AIMarkdown from "@/components/intelliflow/AIMarkdown";
import type { BriefingAction } from "@/hooks/useDailyBriefing";

interface Props {
  summary: string | undefined;
  actions: BriefingAction[];
  isLoading: boolean;
  onRefresh: () => void;
  onAction: (action: BriefingAction) => void;
}

export function OperativeBriefing({ summary, actions, isLoading, onRefresh, onAction }: Props) {
  if (isLoading) {
    return (
      <section className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl p-5 space-y-3">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
          <Bot className="h-3.5 w-3.5" />
          Briefing Operativo
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Analisi in corso…
        </div>
      </section>
    );
  }

  if (!summary) return null;

  return (
    <section className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
          <Bot className="h-3.5 w-3.5" />
          Briefing Operativo
        </div>
        <button
          onClick={onRefresh}
          className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          title="Aggiorna briefing"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="ai-prose max-w-none text-sm">
        <AIMarkdown content={summary} />
      </div>

      {actions.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap pt-1">
          {actions.map((action, i) => (
            <Button
              key={i}
              variant="outline"
              size="sm"
              className="h-7 text-[11px] gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
              onClick={() => onAction(action)}
            >
              <Zap className="h-3 w-3" />
              {action.agentName && (
                <span className="text-muted-foreground">{action.agentName}:</span>
              )}
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </section>
  );
}
