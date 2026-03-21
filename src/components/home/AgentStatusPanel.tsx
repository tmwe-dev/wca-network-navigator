import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { AgentStatusItem } from "@/hooks/useDailyBriefing";

interface Props {
  agents: AgentStatusItem[];
}

export function AgentStatusPanel({ agents }: Props) {
  const navigate = useNavigate();

  if (!agents || agents.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl p-4 space-y-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        👥 Team Agenti
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {agents.map((agent) => {
          const isWorking = agent.activeTasks > 0;
          return (
            <button
              key={agent.id}
              onClick={() => navigate(`/agent-chat?agent=${agent.id}`)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all hover:scale-105",
                isWorking
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border/50 bg-muted/30 text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="text-base leading-none">{agent.emoji}</span>
              <span>{agent.name}</span>
              {isWorking && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/20 px-1 text-[10px] font-bold text-primary">
                  {agent.activeTasks}
                </span>
              )}
              {!isWorking && agent.completedToday > 0 && (
                <span className="text-[10px] text-muted-foreground/60">
                  ✓{agent.completedToday}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
