import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Plus, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useAgentTasks, type AgentTask } from "@/hooks/useAgentTasks";
import type { Agent } from "@/hooks/useAgents";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Clock className="w-3.5 h-3.5 text-muted-foreground" />,
  running: <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />,
  completed: <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />,
  failed: <XCircle className="w-3.5 h-3.5 text-destructive" />,
};

interface Props {
  agent: Agent;
}

export function AgentTaskList({ agent }: Props) {
  const { tasks, isLoading, createTask, executeTask } = useAgentTasks(agent.id);
  const [desc, setDesc] = useState("");
  const [taskType, setTaskType] = useState("outreach");

  const addTask = () => {
    if (!desc.trim()) return;
    createTask.mutate(
      { agent_id: agent.id, description: desc.trim(), task_type: taskType },
      { onSuccess: () => { setDesc(""); toast.success("Task creato"); } }
    );
  };

  const runTask = (taskId: string) => {
    executeTask.mutate(taskId, {
      onSuccess: () => toast.success("Task avviato"),
      onError: (e) => toast.error("Errore: " + (e as Error).message),
    });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Compiti ({tasks.length})</h3>
      {/* New task */}
      <div className="flex gap-2">
        <Select value={taskType} onValueChange={setTaskType}>
          <SelectTrigger className="w-[130px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="outreach">Outreach</SelectItem>
            <SelectItem value="download">Download</SelectItem>
            <SelectItem value="research">Ricerca</SelectItem>
            <SelectItem value="analysis">Analisi</SelectItem>
            <SelectItem value="call">Telefonate</SelectItem>
          </SelectContent>
        </Select>
        <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Descrivi il compito..." className="text-sm flex-1" onKeyDown={(e) => e.key === "Enter" && addTask()} />
        <Button size="sm" onClick={addTask} disabled={!desc.trim()}>
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>
      {/* Task list */}
      {isLoading ? (
        <p className="text-xs text-muted-foreground text-center py-4">Caricamento...</p>
      ) : tasks.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">Nessun compito assegnato</p>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {tasks.map((task) => (
            <div key={task.id} className="flex items-start gap-2 p-2.5 rounded-lg border border-border/50 bg-card/30">
              {STATUS_ICONS[task.status] || STATUS_ICONS.pending}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium">{task.description}</p>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                  <span className="uppercase">{task.task_type}</span>
                  <span>·</span>
                  <span>{task.status}</span>
                  {task.result_summary && (
                    <>
                      <span>·</span>
                      <span className="truncate">{task.result_summary}</span>
                    </>
                  )}
                </div>
              </div>
              {task.status === "pending" && (
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => runTask(task.id)} disabled={executeTask.isPending} aria-label="Esegui">
                  <Play className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
