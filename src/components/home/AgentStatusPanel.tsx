import { useEffect, useState } from "react";
import { useAppNavigate } from "@/hooks/useAppNavigate";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { resolveAgentAvatar } from "@/data/agentAvatars";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { ChevronRight } from "lucide-react";
import type { AgentStatusItem } from "@/hooks/useDailyBriefing";
import type { AgentTaskBreakdown } from "@/v2/io/supabase/queries/dashboard";

interface Props {
  agents: AgentStatusItem[];
  breakdowns?: AgentTaskBreakdown[];
}

export function AgentStatusPanel({ agents: initialAgents, breakdowns }: Props) {
  const navigate = useAppNavigate();
  const [agents, setAgents] = useState(initialAgents);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => { setAgents(initialAgents); }, [initialAgents]);

  // Auto-select first agent
  useEffect(() => {
    if (initialAgents.length > 0 && !selectedId) {
      setSelectedId(initialAgents[0].id);
    }
  }, [initialAgents, selectedId]);

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

  const selected = agents.find(a => a.id === selectedId) ?? agents[0];
  const bd = breakdowns?.find(b => b.agentId === selected.id);
  const avatarSrc = resolveAgentAvatar(selected.name, selected.emoji);
  const isWorking = (bd?.running ?? selected.activeTasks) > 0;
  const completed = bd?.completedToday ?? selected.completedToday;

  return (
    <section className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl overflow-hidden">
      {/* Horizontal agent tabs */}
      <div className="flex border-b border-border/40 overflow-x-auto scrollbar-hide">
        {agents.map((agent) => {
          const isActive = agent.id === selectedId;
          const agentAvatar = resolveAgentAvatar(agent.name, agent.emoji);
          const agentBd = breakdowns?.find(b => b.agentId === agent.id);
          const working = (agentBd?.running ?? agent.activeTasks) > 0;

          return (
            <button
              key={agent.id}
              onClick={() => setSelectedId(agent.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-all whitespace-nowrap border-b-2 -mb-px",
                isActive
                  ? "border-primary text-foreground bg-primary/5"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
              )}
            >
              {agentAvatar ? (
                <Avatar className="h-5 w-5">
                  <AvatarImage src={agentAvatar} alt={agent.name} />
                  <AvatarFallback className="text-[8px]">{agent.emoji}</AvatarFallback>
                </Avatar>
              ) : (
                <span className="text-sm">{agent.emoji}</span>
              )}
              <span>{agent.name}</span>
              {working && <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />}
            </button>
          );
        })}
      </div>

      {/* Selected agent detail */}
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* Large avatar + name */}
          <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
            {avatarSrc ? (
              <Avatar className="h-16 w-16 ring-2 ring-border/30">
                <AvatarImage src={avatarSrc} alt={selected.name} />
                <AvatarFallback className="text-xl">{selected.emoji}</AvatarFallback>
              </Avatar>
            ) : (
              <span className="text-5xl">{selected.emoji}</span>
            )}
            <span className="text-xs font-semibold text-foreground">{selected.name}</span>
            {isWorking && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                Attivo
              </span>
            )}
          </div>

          {/* Right side: primary metric + secondary row */}
          <div className="flex-1 min-w-0 space-y-3">
            {/* Primary metric: completati */}
            <div className="flex items-baseline gap-2">
              <span className={cn("text-3xl font-bold leading-none", completed > 0 ? "text-emerald-500" : "text-muted-foreground/40")}>
                {completed}
              </span>
              <span className="text-xs text-muted-foreground">completati oggi</span>
            </div>

            {/* Secondary metrics */}
            {bd ? (
              <div className="flex gap-4">
                <MetricPill label="Preparati" count={bd.proposed} color="text-amber-500" />
                <MetricPill label="In corso" count={bd.running} color="text-blue-500" />
                <MetricPill label="In coda" count={bd.pending} color="text-orange-500" />
              </div>
            ) : (
              <div className="text-xs text-muted-foreground/60">
                {selected.activeTasks > 0 ? `${selected.activeTasks} task attivi` : "Nessun task attivo"}
              </div>
            )}

            {/* Last task */}
            {selected.lastTask && (
              <div className="text-[10px] text-muted-foreground/60 truncate italic">
                Ultimo: {selected.lastTask}
              </div>
            )}

            {/* Navigate to agent */}
            <button
              onClick={() => navigate(`/agent-chat?agent=${selected.id}`)}
              className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 font-medium transition-colors mt-1"
            >
              Vai all'agente <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function MetricPill({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex items-baseline gap-1">
      <span className={cn("text-sm font-bold", count > 0 ? color : "text-muted-foreground/40")}>{count}</span>
      <span className="text-[10px] text-muted-foreground/60">{label}</span>
    </div>
  );
}
