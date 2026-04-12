import { useState } from "react";
import { useAppNavigate } from "@/hooks/useAppNavigate";
import { Bot, Loader2, RefreshCw, Zap, CheckCircle2, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AIMarkdown from "@/components/intelliflow/AIMarkdown";
import { BriefingStatsBar } from "@/components/home/BriefingStatsBar";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { BriefingAction, BriefingStats } from "@/hooks/useDailyBriefing";

interface Props {
  completed: string | undefined;
  todo: string | undefined;
  suspended: string | undefined;
  summary?: string;
  actions: BriefingAction[];
  stats: BriefingStats | undefined;
  isLoading: boolean;
  onRefresh: () => void;
  onAction: (action: BriefingAction) => void;
}

export function OperativeBriefing({
  completed, todo, suspended, summary,
  actions, stats, isLoading, onRefresh, onAction,
}: Props) {
  const [executingIdx, setExecutingIdx] = useState<number | null>(null);
  const [completedIdx, setCompletedIdx] = useState<Set<number>>(new Set());
  const qc = useQueryClient();
  const navigate = useAppNavigate();

  const executeAction = async (action: BriefingAction, idx: number) => {
    setExecutingIdx(idx);
    try {
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

        await invokeEdge("agent-execute", { body: { agent_id: agentId, task_id: (task as any).id }, context: "OperativeBriefing.agent_execute" });

        toast.success(`Task assegnato a ${action.agentName}`);
        qc.invalidateQueries({ queryKey: ["agent-tasks"] });
      } else {
        onAction(action);
      }

      setCompletedIdx(prev => new Set(prev).add(idx));
    } catch (e: any) {
      toast.error(e.message || "Errore nell'esecuzione");
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

  const hasContent = completed || todo || suspended || summary;
  if (!hasContent) return null;

  const showTabs = !!(completed || todo || suspended);

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

      {/* Stats bar */}
      {stats && (
        <BriefingStatsBar
          totalContacts={stats.totalContacts}
          inHolding={stats.inHolding}
          notContacted={stats.notContacted}
          scheduledToday={stats.scheduledToday}
        />
      )}

      {/* Quick access to Jobs Board */}
      <Button
        variant="outline"
        size="sm"
        className="w-full h-7 text-[11px] gap-1.5 border-primary/20 text-primary hover:bg-primary/10"
        onClick={() => navigate("/settings?tab=guida-operativa")}
      >
        <Briefcase className="h-3 w-3" />
        Jobs Operativi — Gestisci attività
      </Button>

      {showTabs ? (
        <Tabs defaultValue="todo" className="w-full">
          <TabsList className="w-full grid grid-cols-3 h-8">
            <TabsTrigger value="completed" className="text-[11px] gap-1">✅ Effettuato</TabsTrigger>
            <TabsTrigger value="todo" className="text-[11px] gap-1">📋 Da fare</TabsTrigger>
            <TabsTrigger value="suspended" className="text-[11px] gap-1">⏸ Sospesi</TabsTrigger>
          </TabsList>
          <TabsContent value="completed" className="mt-2">
            <div className="ai-prose max-w-none text-sm">
              <AIMarkdown content={completed || "_Nessun dato disponibile_"} />
            </div>
          </TabsContent>
          <TabsContent value="todo" className="mt-2">
            <div className="ai-prose max-w-none text-sm">
              <AIMarkdown content={todo || "_Nessun task programmato_"} />
            </div>
          </TabsContent>
          <TabsContent value="suspended" className="mt-2">
            <div className="ai-prose max-w-none text-sm">
              <AIMarkdown content={suspended || "_Nessuna attività sospesa_"} />
            </div>
          </TabsContent>
        </Tabs>
      ) : (
        <div className="ai-prose max-w-none text-sm">
          <AIMarkdown content={summary || ""} />
        </div>
      )}

      {/* Actions */}
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
