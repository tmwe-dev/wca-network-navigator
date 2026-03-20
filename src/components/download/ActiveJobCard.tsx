import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, Square, Settings2, Activity, Timer, Zap, ArrowRight, List, Mail, Phone, XCircle } from "lucide-react";
import { getCountryFlag } from "@/lib/countries";
import { usePauseResumeJob, useUpdateJobSpeed, type DownloadJob } from "@/hooks/useDownloadJobs";
import { JobDataViewer } from "./JobDataViewer";
import { JobTerminalViewer } from "./JobTerminalViewer";
import { useTheme, t } from "./theme";

export function ActiveJobCard({ job }: { job: DownloadJob }) {
  const isDark = useTheme();
  const th = t(isDark);
  const pauseResume = usePauseResumeJob();
  const updateSpeed = useUpdateJobSpeed();
  const [showSpeed, setShowSpeed] = useState(false);
  const [showViewer, setShowViewer] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [localDelay, setLocalDelay] = useState(job.delay_seconds);
  useEffect(() => setLocalDelay(job.delay_seconds), [job.delay_seconds]);

  const prevIndexRef = useRef(job.current_index);
  const recentTimesRef = useRef<number[]>([]);
  const lastUpdateRef = useRef(Date.now());

  useEffect(() => {
    const now = Date.now();
    const diff = job.current_index - prevIndexRef.current;
    if (diff > 0 && prevIndexRef.current > 0) {
      const perProfile = (now - lastUpdateRef.current) / diff;
      recentTimesRef.current.push(perProfile);
      if (recentTimesRef.current.length > 10) recentTimesRef.current.shift();
    }
    prevIndexRef.current = job.current_index;
    lastUpdateRef.current = now;
  }, [job.current_index]);

  const progress = job.total_count > 0 ? (job.current_index / job.total_count) * 100 : 0;
  const isActive = job.status === "running" || job.status === "pending";
  const isPaused = job.status === "paused";
  const statusLabel: Record<string, string> = { pending: "In attesa", running: "In corso", paused: "In pausa", completed: "Completato", cancelled: "Cancellato" };

  return (
    <div className={`${th.panel} border ${isActive ? th.panelAmber : th.panelSlate} rounded-2xl p-4 space-y-2.5`}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {isActive && <div className={`w-2 h-2 rounded-full animate-pulse ${th.pulse}`} />}
          <div>
            <p className={`text-sm font-medium ${th.h2}`}>{getCountryFlag(job.country_code)} {job.country_name}</p>
            <p className={`text-xs ${th.dim}`}>{statusLabel[job.status] || job.status} • {job.current_index}/{job.total_count}</p>
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <Button size="sm" variant="ghost" onClick={() => setShowTerminal(true)} className={`h-7 text-xs ${th.btnTest}`}>
            <Activity className="w-3 h-3 mr-1" /> Log
          </Button>
          {isActive && (
            <>
              <Button size="sm" variant="ghost" onClick={() => setShowSpeed(!showSpeed)} className={`h-7 ${th.btnPause}`}><Settings2 className="w-3 h-3" /></Button>
              <Button size="sm" variant="ghost" onClick={() => pauseResume.mutate({ jobId: job.id, action: "pause" })} className={`h-7 text-xs ${th.btnPause}`}><Pause className="w-3 h-3 mr-1" /> Pausa</Button>
              <Button size="sm" variant="ghost" onClick={() => pauseResume.mutate({ jobId: job.id, action: "cancel" })} className={`h-7 text-xs ${th.btnStop}`}><Square className="w-3 h-3 mr-1" /> Stop</Button>
            </>
          )}
          {isPaused && (
            <Button size="sm" onClick={() => pauseResume.mutate({ jobId: job.id, action: "resume" })} className={`h-7 text-xs ${th.btnResume}`}><Play className="w-3 h-3 mr-1" /> Riprendi</Button>
          )}
        </div>
      </div>

      <div className={`w-full h-1.5 rounded-full ${isDark ? "bg-slate-800" : "bg-slate-200"}`}>
        <div className={`h-full rounded-full transition-all ${isDark ? "bg-amber-500" : "bg-sky-500"}`} style={{ width: `${progress}%` }} />
      </div>

      {job.last_processed_company && (
        <p className={`text-xs ${th.dim}`}>Ultimo: <span className={th.logName}>{job.last_processed_company}</span></p>
      )}

      {showSpeed && (
        <div className={`p-2 rounded-lg border ${th.infoBox}`}>
          <label className={`text-xs flex items-center gap-1.5 mb-1.5 ${th.label}`}>
            <Timer className="w-3 h-3" /> Delay: <span className={`font-mono ${th.hi}`}>{localDelay}s</span>
          </label>
          <Slider value={[localDelay]} onValueChange={([v]) => setLocalDelay(v)} onValueCommit={([v]) => updateSpeed.mutate({ jobId: job.id, delay_seconds: v })} min={10} max={60} step={1} />
        </div>
      )}

      {job.error_message && <p className={`text-xs ${th.logErr}`}>⚠️ {job.error_message}</p>}

      <JobDataViewer open={showViewer} onOpenChange={setShowViewer} processedIds={(job.processed_ids as number[]) || []} countryCode={job.country_code} />
      <JobTerminalViewer open={showTerminal} onOpenChange={setShowTerminal} jobId={job.id} />
    </div>
  );
}
