import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Play, Pause, Square, Loader2, Timer, Zap, Activity,
  ArrowRight, Settings2, CheckCircle, List, Mail, Phone, XCircle,
} from "lucide-react";
import { getCountryFlag } from "@/lib/countries";
import {
  useDownloadJobs, usePauseResumeJob, useUpdateJobSpeed,
  type DownloadJob,
} from "@/hooks/useDownloadJobs";
import { JobDataViewer } from "./JobDataViewer";
import { useTheme, t } from "./theme";
import { useScrapingSettings, buildDelayValues, buildDelayLabels } from "@/hooks/useScrapingSettings";

export function JobMonitor() {
  const isDark = useTheme();
  const th = t(isDark);
  const { data: jobs } = useDownloadJobs();
  const pauseResume = usePauseResumeJob();
  const updateSpeed = useUpdateJobSpeed();
  const { settings: scrapingSettings } = useScrapingSettings();
  const DELAY_VALUES = buildDelayValues(scrapingSettings.delayMin, scrapingSettings.delayMax);
  const DELAY_LABELS = buildDelayLabels(DELAY_VALUES);

  const activeJobs = (jobs || []).filter(j => j.status === "running" || j.status === "pending" || j.status === "paused");
  const recentCompleted = (jobs || []).filter(j => j.status === "completed" || j.status === "cancelled").slice(0, 5);

  if (activeJobs.length === 0 && recentCompleted.length === 0) return null;

  return (
    <div className="space-y-3">
      {activeJobs.length > 0 && (
        <p className={`text-sm font-medium ${th.h2}`}>
          <Activity className="w-4 h-4 inline mr-1" />
          Job Attivi ({activeJobs.length})
        </p>
      )}
      {activeJobs.map(job => (
        <JobCard key={job.id} job={job} pauseResume={pauseResume} updateSpeed={updateSpeed} />
      ))}
      {recentCompleted.length > 0 && (
        <>
          <p className={`text-sm font-medium mt-2 ${th.dim}`}>Completati</p>
          {recentCompleted.map(job => (
            <JobCard key={job.id} job={job} pauseResume={pauseResume} updateSpeed={updateSpeed} />
          ))}
        </>
      )}
    </div>
  );
}

function JobCard({ job, pauseResume, updateSpeed }: {
  job: DownloadJob;
  pauseResume: ReturnType<typeof usePauseResumeJob>;
  updateSpeed: ReturnType<typeof useUpdateJobSpeed>;
}) {
  const { settings: scrapingSettings } = useScrapingSettings();
  const DELAY_VALUES = buildDelayValues(scrapingSettings.delayMin, scrapingSettings.delayMax);
  const DELAY_LABELS = buildDelayLabels(DELAY_VALUES);
  const isDark = useTheme();
  const th = t(isDark);
  const [showSpeed, setShowSpeed] = useState(false);
  const [showViewer, setShowViewer] = useState(false);

  const prevIndexRef = useRef(job.current_index);
  const recentTimesRef = useRef<number[]>([]);
  const lastUpdateRef = useRef(Date.now());

  useEffect(() => {
    const now = Date.now();
    const diff = job.current_index - prevIndexRef.current;
    if (diff > 0 && prevIndexRef.current > 0) {
      const elapsed = now - lastUpdateRef.current;
      const perProfile = elapsed / diff;
      recentTimesRef.current.push(perProfile);
      if (recentTimesRef.current.length > 10) recentTimesRef.current.shift();
    }
    prevIndexRef.current = job.current_index;
    lastUpdateRef.current = now;
  }, [job.current_index]);

  const recentAvgMs = recentTimesRef.current.length > 0
    ? recentTimesRef.current.reduce((a, b) => a + b, 0) / recentTimesRef.current.length
    : null;

  const progress = job.total_count > 0 ? (job.current_index / job.total_count) * 100 : 0;
  const isActive = job.status === "running" || job.status === "pending";
  const isPaused = job.status === "paused";

  const statusLabel: Record<string, string> = {
    pending: "In attesa", running: "In corso", paused: "In pausa",
    completed: "Completato", cancelled: "Cancellato", error: "Errore",
  };
  const statusColor = isDark
    ? { running: "text-amber-400", paused: "text-yellow-400", completed: "text-emerald-400", cancelled: "text-slate-500", error: "text-red-400", pending: "text-blue-400" }
    : { running: "text-sky-600", paused: "text-yellow-600", completed: "text-emerald-600", cancelled: "text-slate-400", error: "text-red-600", pending: "text-blue-600" };

  const handleSpeedChange = (delayIdx: number) => {
    updateSpeed.mutate({ jobId: job.id, delay_seconds: DELAY_VALUES[delayIdx] });
  };
  const currentDelayIdx = DELAY_VALUES.findIndex(v => v >= job.delay_seconds);
  const delayIdx = currentDelayIdx >= 0 ? currentDelayIdx : 4;
  const [localDelayIdx, setLocalDelayIdx] = useState(delayIdx);
  useEffect(() => setLocalDelayIdx(delayIdx), [delayIdx]);

  return (
    <div className={`${th.panel} border ${isActive ? th.panelAmber : isPaused ? th.panelAmber : th.panelSlate} rounded-2xl p-4 space-y-2.5`}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {isActive && <div className={`w-2 h-2 rounded-full animate-pulse ${th.pulse}`} />}
          <div>
            <p className={`text-sm font-medium ${th.h2}`}>
              {getCountryFlag(job.country_code)} {job.country_name}
              <span className={`ml-2 text-xs ${th.dim}`}>{job.network_name}</span>
              {job.job_type === "acquisition" && (
                <Badge className="ml-2 text-[10px] px-1.5 py-0 bg-violet-500 text-white border-0">Acquisizione</Badge>
              )}
            </p>
            <p className={`text-xs ${(statusColor as any)[job.status] || th.dim}`}>
              {statusLabel[job.status] || job.status} • {job.current_index}/{job.total_count}
            </p>
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(job.processed_ids as number[])?.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => setShowViewer(true)} className={`h-7 text-xs ${th.btnTest}`}>
              <List className="w-3 h-3 mr-1" /> Dati
            </Button>
          )}
          {isActive && (
            <>
              <Button size="sm" variant="outline" onClick={() => setShowSpeed(!showSpeed)} className={`h-7 ${th.btnPause}`}>
                <Settings2 className="w-3 h-3" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => pauseResume.mutate({ jobId: job.id, action: "pause" })} className={`h-7 text-xs ${th.btnPause}`}>
                <Pause className="w-3 h-3 mr-1" /> Pausa
              </Button>
              <Button size="sm" variant="outline" onClick={() => pauseResume.mutate({ jobId: job.id, action: "cancel" })} className={`h-7 text-xs ${th.btnStop}`}>
                <Square className="w-3 h-3 mr-1" /> Stop
              </Button>
            </>
          )}
          {isPaused && (
            <>
              <Button size="sm" onClick={() => pauseResume.mutate({ jobId: job.id, action: "resume" })} className={`h-7 text-xs ${th.btnResume}`}>
                <Play className="w-3 h-3 mr-1" /> Riprendi
              </Button>
              <Button size="sm" variant="outline" onClick={() => pauseResume.mutate({ jobId: job.id, action: "cancel" })} className={`h-7 text-xs ${th.btnStop}`}>
                <Square className="w-3 h-3 mr-1" /> Annulla
              </Button>
            </>
          )}
        </div>
      </div>

      <div className={`w-full h-1.5 rounded-full ${isDark ? "bg-slate-800" : "bg-slate-200"}`}>
        <div className={`h-full rounded-full transition-all ${isDark ? "bg-amber-500" : "bg-sky-500"}`} style={{ width: `${progress}%` }} />
      </div>

      {/* Timing */}
      {(isActive || isPaused) && job.current_index > 0 && (() => {
        const elapsedMs = new Date(job.updated_at).getTime() - new Date(job.created_at).getTime();
        const elapsedSec = Math.max(elapsedMs / 1000, 1);
        const avgSec = elapsedSec / job.current_index;
        const recentAvgSec = recentAvgMs ? recentAvgMs / 1000 : null;
        const etaBaseSec = recentAvgSec ?? avgSec;
        const remainingSec = etaBaseSec * (job.total_count - job.current_index);
        const fmtTime = (s: number) => s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}min` : s >= 60 ? `${Math.floor(s / 60)}min` : `${Math.floor(s)}s`;
        return (
          <div className={`grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] p-2 rounded-lg border ${th.infoBox}`}>
            <span className={th.body}><Timer className="w-3 h-3 inline mr-1" />Media: <span className={`font-mono ${th.dim}`}>{avgSec.toFixed(1)}s</span></span>
            <span className={th.body}><Zap className="w-3 h-3 inline mr-1" />Corrente: <span className={`font-mono ${th.hi}`}>{recentAvgSec ? `${recentAvgSec.toFixed(1)}s` : "—"}</span></span>
            <span className={th.body}><Activity className="w-3 h-3 inline mr-1" /><span className={`font-mono ${th.hi}`}>{recentAvgSec ? `${(60 / recentAvgSec).toFixed(1)}` : (job.current_index / elapsedSec * 60).toFixed(1)}</span>/min</span>
            <span className={th.body}><ArrowRight className="w-3 h-3 inline mr-1" />ETA: <span className={`font-mono ${th.hi}`}>~{fmtTime(remainingSec)}</span></span>
          </div>
        );
      })()}

      {job.last_processed_company && (
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-xs ${th.dim}`}>
            Ultimo: <span className={th.logName}>{job.last_processed_company}</span>
            <span className={`ml-1 ${th.logId}`}>#{job.last_processed_wca_id}</span>
          </p>
          {job.last_contact_result && (() => {
            const r = job.last_contact_result;
            if (r === 'email+phone') return <Badge className="text-[10px] px-1.5 py-0 bg-emerald-600 text-white border-0"><Mail className="w-3 h-3 mr-0.5" /><Phone className="w-3 h-3 mr-0.5" /></Badge>;
            if (r === 'email_only') return <Badge className="text-[10px] px-1.5 py-0 bg-blue-500 text-white border-0"><Mail className="w-3 h-3 mr-0.5" /></Badge>;
            if (r === 'phone_only') return <Badge className="text-[10px] px-1.5 py-0 bg-blue-500 text-white border-0"><Phone className="w-3 h-3 mr-0.5" /></Badge>;
            return <Badge className="text-[10px] px-1.5 py-0 bg-red-500/80 text-white border-0"><XCircle className="w-3 h-3 mr-0.5" /></Badge>;
          })()}
        </div>
      )}

      {/* Contact summary */}
      {(job.contacts_found_count > 0 || job.contacts_missing_count > 0) && (() => {
        const found = job.contacts_found_count || 0;
        const missing = job.contacts_missing_count || 0;
        const total = found + missing;
        const pct = total > 0 ? Math.round((found / total) * 100) : 0;
        return (
          <div className={`text-xs p-2 rounded-lg border ${th.infoBox}`}>
            <span className={th.body}>
              Contatti: <span className="font-mono text-emerald-500">{found}</span>/{total} ({pct}%)
              <span className="mx-1">|</span>
              Mancanti: <span className="font-mono text-red-400">{missing}</span>
            </span>
            <div className={`w-full h-1 rounded-full flex overflow-hidden mt-1 ${isDark ? "bg-slate-800" : "bg-slate-200"}`}>
              <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
              <div className="h-full bg-red-500/60" style={{ width: `${100 - pct}%` }} />
            </div>
          </div>
        );
      })()}

      {showSpeed && (isActive || isPaused) && (
        <div className={`p-2 rounded-lg border ${th.infoBox}`}>
          <label className={`text-xs flex items-center gap-1.5 mb-1.5 ${th.label}`}>
            <Timer className="w-3 h-3" /> Delay: <span className={`font-mono ${th.hi}`}>{DELAY_LABELS[DELAY_VALUES[localDelayIdx]]}</span>
          </label>
          <Slider value={[localDelayIdx]} onValueChange={([v]) => setLocalDelayIdx(v)} onValueCommit={([v]) => handleSpeedChange(v)} min={0} max={DELAY_VALUES.length - 1} step={1} />
        </div>
      )}

      {job.error_message && <p className={`text-xs ${th.logErr}`}>⚠️ {job.error_message}</p>}
      {job.status === "completed" && job.completed_at && (
        <p className={`text-xs ${th.dim}`}>Completato il {new Date(job.completed_at).toLocaleString("it-IT")}</p>
      )}

      <JobDataViewer
        open={showViewer} onOpenChange={setShowViewer}
        processedIds={(job.processed_ids as number[]) || []}
        countryName={job.country_name} countryCode={job.country_code}
        networkName={job.network_name} isDark={isDark}
      />
    </div>
  );
}
