import { useActiveMissions, type MissionAction } from "@/hooks/useMissionActions";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Rocket, CheckCircle2, Clock, AlertCircle, Loader2 } from "lucide-react";

const statusIcon: Record<string, any> = {
  planned: Clock,
  approved: Clock,
  executing: Loader2,
  completed: CheckCircle2,
  failed: AlertCircle,
};

const statusColor: Record<string, string> = {
  planned: "text-muted-foreground",
  approved: "text-primary",
  executing: "text-amber-500",
  completed: "text-success",
  failed: "text-destructive",
};

export default function ActiveMissionsPanel() {
  const { data: actions = [], isLoading } = useActiveMissions();

  if (isLoading || actions.length === 0) return null;

  // Group by mission_id
  const grouped = new Map<string, MissionAction[]>();
  for (const a of actions) {
    const list = grouped.get(a.mission_id) || [];
    list.push(a);
    grouped.set(a.mission_id, list);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Rocket className="w-4 h-4 text-primary" />
        <span className="text-xs font-bold text-foreground">Missioni Attive</span>
        <Badge variant="secondary" className="text-[10px] ml-auto">{grouped.size}</Badge>
      </div>

      {Array.from(grouped.entries()).map(([missionId, missionActions]) => {
        const total = missionActions.length;
        const completed = missionActions.filter(a => a.status === "completed").length;
        const failed = missionActions.filter(a => a.status === "failed").length;
        const pct = total > 0 ? Math.round(((completed + failed) / total) * 100) : 0;
        const currentAction = missionActions.find(a => a.status === "executing") || missionActions.find(a => a.status === "approved");
        const StatusIcon = currentAction ? (statusIcon[currentAction.status] || Clock) : CheckCircle2;

        return (
          <div key={missionId} className="p-2.5 rounded-lg border border-border/20 bg-muted/10 space-y-1.5">
            <div className="flex items-center gap-2">
              <StatusIcon className={`w-3.5 h-3.5 ${currentAction ? statusColor[currentAction.status] : "text-success"} ${currentAction?.status === "executing" ? "animate-spin" : ""}`} />
              <span className="text-xs font-medium text-foreground truncate flex-1">
                {currentAction?.action_label || "Missione completata"}
              </span>
              <span className="text-[10px] text-muted-foreground">{completed}/{total}</span>
            </div>
            <Progress value={pct} className="h-1" />
            {failed > 0 && (
              <p className="text-[10px] text-destructive">{failed} azioni fallite</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
