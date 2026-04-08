import { useState } from "react";
import { Bot, Loader2, RefreshCw, Zap, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import AIMarkdown from "@/components/intelliflow/AIMarkdown";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { BriefingAction } from "@/hooks/useDailyBriefing";

interface Props {
  summary: string | undefined;
  actions: BriefingAction[];
  isLoading: boolean;
  onRefresh: () => void;
  onAction: (action: BriefingAction) => void;
}

export function OperativeBriefing({ summary, actions, isLoading, onRefresh, onAction }: Props) {
  const [executingIdx, setExecutingIdx] = useState<number | null>(null);
  const [completedIdx, setCompletedIdx] = useState<Set<number>>(new Set());
  const qc = useQueryClient();

  const executeAction = async (action: BriefingAction, idx: number) => {
    setExecutingIdx(idx);
    try {
      // Find agent by name if specified
      let agentId: string | null = null;
      if (action.agentName) {
        const { data: agents } = await supabase
          .from("agents")
          .select("id, name")
          .eq("is_active", true);
        const match = agents?.find(a =>
          a.name.toLowerCase() === action.agentName!.toLowerCase()
        );
        agentId = match?.id ?? null;
      }

      if (agentId) {
        // Create a real agent task and execute it
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Non autenticato");

        const { data: task, error: taskErr } = await supabase
          .from("agent_tasks")
          .insert({
            agent_id: agentId,
            user_id: user.id,
            task_type: "briefing_action",
            description: action.prompt,
            status: "pending",
          } as any)
          .select("id")
          .single();
        if (taskErr) throw taskErr;

        // Fire agent-execute (lancia ApiError on failure, catturato dal try esterno)
        await invokeEdge("agent-execute", { body: { agent_id: agentId, task_id: (task as any).id }, context: "OperativeBriefing.agent_execute" });

        toast.success(`Task assegnato a ${action.agentName}`);
        qc.invalidateQueries({ queryKey: ["agent-tasks"] });
      } else {
        // Fallback: send to AI assistant and show response via prompt
        onAction(action);
      }

      setCompletedIdx(prev => new Set(prev).add(idx));
    } catch (e: any) {
      toast.error(e.message || "Errore nell'esecuzione");
      // Fallback to prompt
      onAction(action);
    } finally {
      setExecutingIdx(null);
    }
  };

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
          {actions.map((action, i) => {
            const isExecuting = executingIdx === i;
            const isDone = completedIdx.has(i);
            return (
              <Button
                key={i}
                variant="outline"
                size="sm"
                className="h-7 text-[11px] gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                onClick={() => executeAction(action, i)}
                disabled={isExecuting || isDone}
              >
                {isExecuting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : isDone ? (
                  <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                ) : (
                  <Zap className="h-3 w-3" />
                )}
                {action.agentName && (
                  <span className="text-muted-foreground">{action.agentName}:</span>
                )}
                {action.label}
              </Button>
            );
          })}
        </div>
      )}
    </section>
  );
}
