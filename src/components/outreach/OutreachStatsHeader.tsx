/**
 * OutreachStatsHeader — Collapsible stats bar for the Outreach page
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Send, CheckCircle2, Calendar, Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchOutreachStats } from "@/data/outreachPipeline";
import { queryKeys } from "@/lib/queryKeys";

function StatCard({ icon: Icon, label, value, color }: { icon: typeof Send; label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-card/50 border border-border/30">
      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", color)}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-lg font-bold text-foreground leading-none">{value}</p>
        <p className="text-[10px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export function OutreachStatsHeader() {
  const [expanded, setExpanded] = useState(false);

  const { data: stats } = useQuery({
    queryKey: queryKeys.outreach.stats,
    queryFn: fetchOutreachStats,
    refetchInterval: 60000,
  });

  const s = stats ?? { pending: 0, sentToday: 0, scheduled: 0, awaitingResponse: 0, failed: 0 };

  return (
    <div className="border-b border-border/30 bg-muted/10">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-1.5 hover:bg-muted/20 transition-colors"
      >
        <span className="text-xs font-medium text-foreground">Pipeline Outreach</span>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-muted-foreground">
            {s.pending} da inviare · {s.sentToday} oggi · {s.failed > 0 ? `${s.failed} falliti` : ""}
          </span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-3 pt-1 grid grid-cols-5 gap-2">
          <StatCard icon={Send} label="Da Inviare" value={s.pending} color="bg-amber-500/10 text-amber-500" />
          <StatCard icon={CheckCircle2} label="Inviati Oggi" value={s.sentToday} color="bg-emerald-500/10 text-emerald-500" />
          <StatCard icon={Calendar} label="Programmati" value={s.scheduled} color="bg-primary/10 text-primary" />
          <StatCard icon={Clock} label="In Attesa Risposta" value={s.awaitingResponse} color="bg-amber-500/10 text-amber-400" />
          <StatCard icon={AlertTriangle} label="Falliti" value={s.failed} color="bg-destructive/10 text-destructive" />
        </div>
      )}
    </div>
  );
}
