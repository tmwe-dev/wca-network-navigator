import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Trash2, Play, CheckCircle, XCircle } from "lucide-react";
import { getCountryFlag } from "@/lib/countries";
import { usePauseResumeJob, useDeleteQueuedJobs, usePurgeOldJobs, type DownloadJob } from "@/hooks/useDownloadJobs";
import { useTheme, t } from "./theme";

export function JobQueue({ jobs }: { jobs: DownloadJob[] }) {
  const isDark = useTheme();
  const th = t(isDark);
  const pauseResume = usePauseResumeJob();
  const deleteQueued = useDeleteQueuedJobs();
  const purgeOld = usePurgeOldJobs();
  const [queueOpen, setQueueOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const queued = jobs.filter(j => j.status === "pending" || j.status === "paused");
  const history = jobs.filter(j => j.status === "completed" || j.status === "cancelled").slice(0, 10);

  if (queued.length === 0 && history.length === 0) return null;

  return (
    <div className="space-y-2">
      {queued.length > 0 && (
        <div>
          <div className="flex items-center justify-between">
            <button onClick={() => setQueueOpen(!queueOpen)} className={`flex items-center gap-1.5 text-sm font-medium py-1 ${th.dim}`}>
              {queueOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              In coda ({queued.length})
            </button>
            <Button size="sm" variant="ghost" onClick={() => deleteQueued.mutate()} className={`h-6 text-[11px] px-2 ${th.btnStop}`}>
              <Trash2 className="w-3 h-3 mr-1" /> Elimina
            </Button>
          </div>
          {queueOpen && queued.map(j => (
            <div key={j.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs ${isDark ? "hover:bg-white/5" : "hover:bg-black/5"}`}>
              <span className="text-base">{getCountryFlag(j.country_code)}</span>
              <span className={`flex-1 truncate ${th.body}`}>{j.country_name}</span>
              <span className={`font-mono tabular-nums ${th.dim}`}>{j.current_index}/{j.total_count}</span>
              {j.status === "paused" && (
                <Button size="sm" variant="ghost" className={`h-5 px-1.5 text-[10px] ${th.btnResume}`} onClick={() => pauseResume.mutate({ jobId: j.id, action: "resume" })}>
                  <Play className="w-2.5 h-2.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {history.length > 0 && (
        <div>
          <div className="flex items-center justify-between">
            <button onClick={() => setHistoryOpen(!historyOpen)} className={`flex items-center gap-1.5 text-sm font-medium py-1 ${th.dim}`}>
              {historyOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              Cronologia ({history.length})
            </button>
            <Button size="sm" variant="ghost" onClick={() => purgeOld.mutate()} className={`h-6 text-[11px] px-2 ${th.btnStop}`}>
              <Trash2 className="w-3 h-3 mr-1" /> Pulisci
            </Button>
          </div>
          {historyOpen && history.map(j => (
            <div key={j.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs ${isDark ? "hover:bg-white/5" : "hover:bg-black/5"}`}>
              <span className="text-base">{getCountryFlag(j.country_code)}</span>
              <span className={`flex-1 truncate ${th.body}`}>{j.country_name}</span>
              <Badge className={`text-[10px] px-1.5 py-0 border-0 ${j.status === "completed" ? "bg-emerald-600 text-white" : "bg-slate-500 text-white"}`}>
                {j.status === "completed" ? <CheckCircle className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
