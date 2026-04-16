import { useEffect, useState } from "react";
import { useAppNavigate } from "@/hooks/useAppNavigate";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { resolveAgentAvatar } from "@/data/agentAvatars";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import type { AgentStatusItem } from "@/hooks/useDailyBriefing";
import type { AgentTaskBreakdown } from "@/v2/io/supabase/queries/dashboard";

interface Props {
  agents: AgentStatusItem[];
  breakdowns?: AgentTaskBreakdown[];
}

export function AgentStatusPanel({ agents: initialAgents, breakdowns }: Props) {
  const navigate = useAppNavigate();
  const [agents, setAgents] = useState(initialAgents);

  useEffect(() => { setAgents(initialAgents); }, [initialAgents]);

  useEffect(() => {
    if (!initialAgents || initialAgents.length === 0) return;

    const channel = supabase
      .channel("home-agent-tasks")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agent_tasks" },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          if (!row?.agent_id) return;
          setAgents(prev =>
            prev.map(a => {
              if (a.id !== row.agent_id) return a;
              if (payload.eventType === "INSERT" || (payload.eventType === "UPDATE" && ["pending", "running"].includes(row.status as string))) {
                if (payload.eventType === "INSERT") {
                  toast.info(`🤖 ${a.name}: nuovo task`, { description: String(row.description ?? "Task assegnato").slice(0, 80), duration: 5000 });
                }
                return { ...a, activeTasks: a.activeTasks + (payload.eventType === "INSERT" ? 1 : 0), lastTask: (String(row.description ?? "") || a.lastTask) as string | null };
              }
              if (payload.eventType === "UPDATE" && row.status === "completed") {
                return { ...a, activeTasks: Math.max(0, a.activeTasks - 1), completedToday: a.completedToday + 1, lastTask: String(row.description ?? '') || a.lastTask };
              }
              return a;
            })
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [initialAgents]);

  if (!agents || agents.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl p-4 space-y-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        👥 Team Agenti
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {agents.map((agent) => {
          const bd = breakdowns?.find(b => b.agentId === agent.id);
          const isWorking = (bd?.running ?? agent.activeTasks) > 0;
          const avatarSrc = resolveAgentAvatar(agent.name, agent.emoji);
          const totalActive = bd ? bd.proposed + bd.running + bd.pending : agent.activeTasks;
          const completed = bd?.completedToday ?? agent.completedToday;

          return (
            <button
              key={agent.id}
              onClick={() => navigate(`/agent-chat?agent=${agent.id}`)}
              className={cn(
                "flex flex-col gap-1.5 rounded-xl border p-3 text-left transition-all hover:scale-[1.02]",
                isWorking
                  ? "border-primary/40 bg-primary/5"
                  : "border-border/50 bg-muted/20 hover:bg-muted/30"
              )}
            >
              {/* Header: avatar + name */}
              <div className="flex items-center gap-2">
                {avatarSrc ? (
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={avatarSrc} alt={agent.name} />
                    <AvatarFallback className="text-xs">{agent.emoji}</AvatarFallback>
                  </Avatar>
                ) : (
                  <span className="text-lg leading-none">{agent.emoji}</span>
                )}
                <span className="text-xs font-semibold text-foreground truncate">{agent.name}</span>
                {isWorking && (
                  <span className="ml-auto flex h-2 w-2 rounded-full bg-primary animate-pulse" />
                )}
              </div>

              {/* Task breakdown */}
              {bd ? (
                <div className="grid grid-cols-4 gap-1 pl-1">
                  <TaskBadge label="Preparati" count={bd.proposed} color="text-amber-500" />
                  <TaskBadge label="In corso" count={bd.running} color="text-blue-500" />
                  <TaskBadge label="In coda" count={bd.pending} color="text-orange-500" />
                  <TaskBadge label="Completati" count={completed} color="text-emerald-500" />
                </div>
              ) : (
                <>
                  {isWorking ? (
                    <div className="text-[10px] text-primary/80 truncate pl-7">
                      {totalActive} task attivi
                    </div>
                  ) : completed > 0 ? (
                    <div className="text-[10px] text-muted-foreground/70 truncate pl-7">
                      ✓ {completed} completati oggi
                    </div>
                  ) : (
                    <div className="text-[10px] text-muted-foreground/50 pl-7">Idle</div>
                  )}
                </>
              )}

              {/* Progress bar when breakdown available */}
              {bd && totalActive > 0 && (
                <div className="w-full h-1 rounded-full bg-muted/40 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary/60 transition-all"
                    style={{ width: `${Math.min(100, (completed / (totalActive + completed)) * 100)}%` }}
                  />
                </div>
              )}

              {agent.lastTask && (
                <div className="text-[10px] text-muted-foreground/60 truncate pl-1 italic">
                  {agent.lastTask}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function TaskBadge({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="text-center">
      <div className={cn("text-sm font-bold leading-none", count > 0 ? color : "text-muted-foreground/40")}>
        {count}
      </div>
      <div className="text-[8px] text-muted-foreground/60 mt-0.5 truncate">{label}</div>
    </div>
  );
}
