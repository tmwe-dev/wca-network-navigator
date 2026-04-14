/**
 * Staff Direzionale — Canvas chat con i 4 consulenti AI.
 * Layout a due colonne: lista agenti a sinistra, chat canvas a destra.
 * Supporta drag & drop file, microfono, TTS e job list.
 */
import { useState } from "react";
import { useAgents } from "@/hooks/useAgents";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTrackPage } from "@/hooks/useTrackPage";
import { cn } from "@/lib/utils";
import { Loader2, Briefcase, Crown, Circle } from "lucide-react";
import { StaffChatCanvas } from "@/components/staff/StaffChatCanvas";
import { queryKeys } from "@/lib/queryKeys";

interface JobRow {
  id: string;
  title: string;
  status: string;
  created_at: string;
  current_step: number;
  steps: Record<string, unknown>;
}

const STAFF_ROLES = ["director", "account_manager", "strategist", "sales", "outreach", "research"];

export default function StaffDirezionale() {
  useTrackPage("staff_direzionale");

  const { agents, isLoading } = useAgents();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showJobs, setShowJobs] = useState(false);

  // Filter staff agents (those with director/manager/strategist roles)
  const staffAgents = agents.filter((a) =>
    STAFF_ROLES.some((r) => a.role.toLowerCase().includes(r)) || a.name.toLowerCase().includes("luca") || a.name.toLowerCase().includes("gigi") || a.name.toLowerCase().includes("felice") || a.name.toLowerCase().includes("gianfranco")
  );

  const activeAgent = staffAgents.find((a) => a.id === activeId) ?? (staffAgents.length > 0 ? staffAgents[0] : null);

  // Jobs from ai_work_plans
  const { data: jobs } = useQuery({
    queryKey: queryKeys.downloads.staffJobs(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_work_plans")
        .select("id, title, status, created_at, current_step, steps")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as JobRow[];
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (staffAgents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <Crown className="w-10 h-10" />
        <p className="text-sm font-medium">Nessun agente staff configurato</p>
        <p className="text-xs text-center max-w-sm">
          Crea agenti con ruolo Director, Account Manager o Strategist per vederli qui.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-background">
      {/* Left: Agent list + Jobs */}
      <div className="w-72 border-r border-border/40 flex flex-col bg-card/30 shrink-0">
        <div className="px-4 py-3 border-b border-border/30">
          <h1 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Crown className="w-4 h-4 text-primary" />
            Staff Direzionale
          </h1>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {staffAgents.length} consulenti AI
          </p>
        </div>

        {/* Staff list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {staffAgents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => setActiveId(agent.id)}
              className={cn(
                "w-full text-left p-3 rounded-xl transition-all",
                activeAgent?.id === agent.id
                  ? "bg-primary/10 border border-primary/30"
                  : "hover:bg-muted/50 border border-transparent"
              )}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{agent.avatar_emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{agent.name}</div>
                  <div className="text-[11px] text-muted-foreground capitalize">{agent.role}</div>
                </div>
                <Circle className={cn("w-2 h-2 fill-current shrink-0", agent.is_active ? "text-emerald-500" : "text-muted-foreground")} />
              </div>
            </button>
          ))}
        </div>

        {/* Jobs toggle */}
        <div className="border-t border-border/30">
          <button
            onClick={() => setShowJobs(!showJobs)}
            className="w-full text-left px-4 py-2.5 flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Job attivi ({jobs?.filter((j) => j.status !== "completed").length ?? 0})</span>
          </button>
          {showJobs && jobs && (
            <div className="max-h-48 overflow-y-auto px-3 pb-3 space-y-1">
              {jobs.length === 0 && (
                <p className="text-[11px] text-muted-foreground/60 px-1">Nessun job</p>
              )}
              {jobs.map((j) => (
                <div key={j.id} className="text-[11px] p-2 rounded-lg bg-muted/30 border border-border/30">
                  <div className="font-medium text-foreground truncate">{j.title}</div>
                  <div className="flex items-center gap-2 mt-1 text-muted-foreground">
                    <span className={cn(
                      "px-1.5 py-0.5 rounded text-[9px] font-medium",
                      j.status === "completed" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                      j.status === "in_progress" ? "bg-primary/10 text-primary" :
                      "bg-muted text-muted-foreground"
                    )}>
                      {j.status}
                    </span>
                    <span>{new Date(j.created_at).toLocaleDateString("it-IT")}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Chat canvas */}
      <div className="flex-1 min-w-0">
        {activeAgent ? (
          <StaffChatCanvas agent={activeAgent} />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Seleziona un consulente
          </div>
        )}
      </div>
    </div>
  );
}
