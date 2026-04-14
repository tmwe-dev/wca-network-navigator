import { useEffect, useState } from "react";
import { useAppNavigate } from "@/hooks/useAppNavigate";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { resolveAgentAvatar } from "@/data/agentAvatars";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import type { AgentStatusItem } from "@/hooks/useDailyBriefing";

interface Props {
  agents: AgentStatusItem[];
}

export function AgentStatusPanel({ agents: initialAgents }: Props) {
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
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {agents.map((agent) => {
          const isWorking = agent.activeTasks > 0;
          const avatarSrc = resolveAgentAvatar(agent.name, agent.emoji);
          return (
            <button
              key={agent.id}
              onClick={() => navigate(`/agent-chat?agent=${agent.id}`)}
              className={cn(
                "flex flex-col gap-1 rounded-xl border p-3 text-left transition-all hover:scale-[1.02]",
                isWorking
                  ? "border-primary/40 bg-primary/5"
                  : "border-border/50 bg-muted/20 hover:bg-muted/30"
              )}
            >
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

              {isWorking ? (
                <div className="text-[10px] text-primary/80 truncate pl-7">
                  {agent.activeTasks} task attivi
                </div>
              ) : agent.completedToday > 0 ? (
                <div className="text-[10px] text-muted-foreground/70 truncate pl-7">
                  ✓ {agent.completedToday} completati oggi
                </div>
              ) : (
                <div className="text-[10px] text-muted-foreground/50 pl-7">Idle</div>
              )}

              {agent.lastTask && (
                <div className="text-[10px] text-muted-foreground/60 truncate pl-7 italic">
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
