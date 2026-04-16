/**
 * AgentTasksPage — Mostra i task proposti dagli agenti in attesa di conferma
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Clock, Bot, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { queryKeys } from "@/lib/queryKeys";

interface AgentTask {
  id: string;
  agent_id: string;
  task_type: string;
  description: string;
  status: string;
  target_filters: Record<string, unknown>;
  created_at: string;
  scheduled_at: string | null;
  result_summary: string | null;
}

function useAgentTasks() {
  return useQuery({
    queryKey: ["v2", "agent-tasks-pending"],
    queryFn: async () => {
      const { data: tasks, error } = await (supabase as any)
        .from("agent_tasks")
        .select("*")
        .in("status", ["proposed", "pending"])
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;

      // Fetch agent names
      const agentIds = [...new Set((tasks || []).map((t: AgentTask) => t.agent_id))];
      const { data: agents } = await (supabase as any)
        .from("agents")
        .select("id, name, avatar_emoji, role")
        .in("id", agentIds.length ? agentIds : ["__none__"]);

      const agentMap = new Map((agents || []).map((a: any) => [a.id, a]));
      return (tasks || []).map((t: AgentTask) => ({
        ...t,
        agent: agentMap.get(t.agent_id) || { name: "Sconosciuto", avatar_emoji: "🤖", role: "agent" },
      }));
    },
    refetchInterval: 30_000,
  });
}

function TaskCard({ task, onApprove, onReject, isUpdating }: {
  task: AgentTask & { agent: { name: string; avatar_emoji: string; role: string } };
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  isUpdating: boolean;
}) {
  const typeLabels: Record<string, string> = {
    screening: "Screening",
    deep_search: "Ricerca approfondita",
    outreach: "Outreach",
    analysis: "Analisi",
    followup: "Follow-up",
    enrichment: "Arricchimento",
  };

  return (
    <Card className="border-border/50 hover:border-primary/30 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{task.agent.avatar_emoji}</span>
              <span className="text-sm font-medium text-foreground">{task.agent.name}</span>
              <Badge variant="outline" className="text-xs">
                {typeLabels[task.task_type] || task.task_type}
              </Badge>
              <Badge variant={task.status === "proposed" ? "secondary" : "default"} className="text-xs">
                {task.status === "proposed" ? "Da confermare" : task.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">{task.description}</p>
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {format(new Date(task.created_at), "d MMM HH:mm", { locale: it })}
              </span>
              {task.scheduled_at && (
                <span>Programmato: {format(new Date(task.scheduled_at), "d MMM HH:mm", { locale: it })}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => onReject(task.id)}
              disabled={isUpdating}
            >
              <X className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              onClick={() => onApprove(task.id)}
              disabled={isUpdating}
            >
              {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
              Approva
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AgentTasksPage() {
  const { data: tasks, isLoading, error } = useAgentTasks();
  const queryClient = useQueryClient();
  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await (supabase as any)
        .from("agent_tasks")
        .update({ status, started_at: status === "running" ? new Date().toISOString() : undefined })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["v2", "agent-tasks-pending"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.smartSuggestions });
      toast.success(status === "running" ? "Task approvato" : "Task rifiutato");
    },
    onError: () => toast.error("Errore nell'aggiornamento del task"),
  });

  const handleApprove = (id: string) => updateMutation.mutate({ id, status: "running" });
  const handleReject = (id: string) => updateMutation.mutate({ id, status: "cancelled" });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-destructive">
        <AlertTriangle className="h-5 w-5 mr-2" />
        Errore nel caricamento dei task
      </div>
    );
  }

  const pending = tasks || [];

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="h-6 w-6 text-primary" />
            Task Agenti da Confermare
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {pending.length} task in attesa di approvazione
          </p>
        </div>
        {pending.length > 1 && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => pending.forEach((t: any) => handleReject(t.id))}
              disabled={updateMutation.isPending}
            >
              <X className="h-4 w-4 mr-1" />
              Rifiuta tutti
            </Button>
            <Button
              size="sm"
              onClick={() => pending.forEach((t: any) => handleApprove(t.id))}
              disabled={updateMutation.isPending}
            >
              <Check className="h-4 w-4 mr-1" />
              Approva tutti
            </Button>
          </div>
        )}
      </div>

      {pending.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Bot className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground">Nessun task in attesa</h3>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Gli agenti non hanno proposto task da confermare
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {pending.map((task: any) => (
            <TaskCard
              key={task.id}
              task={task}
              onApprove={handleApprove}
              onReject={handleReject}
              isUpdating={updateMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}
