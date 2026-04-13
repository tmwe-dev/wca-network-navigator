import { useActiveMissions, type MissionAction } from "@/hooks/useMissionActions";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Rocket, CheckCircle2, Clock, AlertCircle, Loader2, Pause, Play, X } from "lucide-react";
import { toast } from "sonner";
import { pauseMission, resumeMission, cancelMission } from "@/data/outreachPipeline";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

const statusIcon: Record<string, typeof Clock> = {
  planned: Clock,
  approved: Clock,
  executing: Loader2,
  completed: CheckCircle2,
  failed: AlertCircle,
  paused: Pause,
};

const statusColor: Record<string, string> = {
  planned: "text-muted-foreground",
  approved: "text-primary",
  executing: "text-amber-500",
  completed: "text-emerald-500",
  failed: "text-destructive",
  paused: "text-blue-400",
};

export default function ActiveMissionsPanel() {
  const { data: actions = [], isLoading } = useActiveMissions();
  const qc = useQueryClient();
  const [acting, setActing] = useState<string | null>(null);

  if (isLoading || actions.length === 0) return null;

  const grouped = new Map<string, MissionAction[]>();
  for (const a of actions) {
    const list = grouped.get(a.mission_id) || [];
    list.push(a);
    grouped.set(a.mission_id, list);
  }

  const handlePause = async (missionId: string) => {
    setActing(missionId);
    try { await pauseMission(missionId); qc.invalidateQueries({ queryKey: ["active-mission-actions"] }); toast.success("Missione in pausa"); }
    catch { toast.error("Errore pausa"); }
    finally { setActing(null); }
  };

  const handleResume = async (missionId: string) => {
    setActing(missionId);
    try { await resumeMission(missionId); qc.invalidateQueries({ queryKey: ["active-mission-actions"] }); toast.success("Missione ripresa"); }
    catch { toast.error("Errore ripresa"); }
    finally { setActing(null); }
  };

  const handleCancel = async (missionId: string) => {
    if (!confirm("Annullare questa missione?")) return;
    setActing(missionId);
    try { await cancelMission(missionId); qc.invalidateQueries({ queryKey: ["active-mission-actions"] }); toast.info("Missione annullata"); }
    catch { toast.error("Errore annullamento"); }
    finally { setActing(null); }
  };

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
        const paused = missionActions.some(a => (a.status as string) === "paused");
        const pct = total > 0 ? Math.round(((completed + failed) / total) * 100) : 0;
        const currentAction = missionActions.find(a => a.status === "executing") || missionActions.find(a => a.status === "approved");
        const StatusIcon = currentAction ? (statusIcon[currentAction.status] || Clock) : CheckCircle2;

        return (
          <div key={missionId} className="p-2.5 rounded-lg border border-border/20 bg-muted/10 space-y-1.5">
            <div className="flex items-center gap-2">
              <StatusIcon className={`w-3.5 h-3.5 ${currentAction ? statusColor[currentAction.status] : "text-emerald-500"} ${currentAction?.status === "executing" ? "animate-spin" : ""}`} />
              <span className="text-xs font-medium text-foreground truncate flex-1">
                {currentAction?.action_label || (paused ? "Missione in pausa" : "Missione completata")}
              </span>
              <span className="text-[10px] text-muted-foreground">{completed}/{total}</span>
            </div>
            <Progress value={pct} className="h-1" />
            {failed > 0 && <p className="text-[10px] text-destructive">{failed} azioni fallite</p>}
            <div className="flex items-center gap-1 pt-0.5">
              {paused ? (
                <Button size="sm" variant="outline" className="h-5 text-[9px] gap-1 px-1.5" onClick={() => handleResume(missionId)} disabled={acting === missionId}>
                  <Play className="w-2.5 h-2.5" /> Riprendi
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="h-5 text-[9px] gap-1 px-1.5" onClick={() => handlePause(missionId)} disabled={acting === missionId}>
                  <Pause className="w-2.5 h-2.5" /> Pausa
                </Button>
              )}
              <Button size="sm" variant="ghost" className="h-5 text-[9px] gap-1 px-1.5 text-destructive" onClick={() => handleCancel(missionId)} disabled={acting === missionId}>
                <X className="w-2.5 h-2.5" /> Annulla
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
