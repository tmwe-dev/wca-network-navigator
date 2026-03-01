import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Play, Pause, Square, Loader2, Timer, Zap, Activity,
  ArrowRight, Settings2, CheckCircle, List, Mail, Phone, XCircle,
  ChevronDown, ChevronRight, Trash2, AlertTriangle,
} from "lucide-react";
import { getCountryFlag } from "@/lib/countries";
import {
  useDownloadJobs, usePauseResumeJob, useUpdateJobSpeed, useDeleteQueuedJobs, usePurgeOldJobs,
  type DownloadJob,
} from "@/hooks/useDownloadJobs";
import { JobDataViewer } from "./JobDataViewer";
import { JobTerminalViewer } from "./JobTerminalViewer";
import { useTheme, t } from "./theme";

export function JobMonitor() {
  const isDark = useTheme();
  const th = t(isDark);
  const { data: jobs } = useDownloadJobs();
  const pauseResume = usePauseResumeJob();
  const updateSpeed = useUpdateJobSpeed();
  const deleteQueued = useDeleteQueuedJobs();
  const purgeOld = usePurgeOldJobs();

  const runningJob = (jobs || []).find(j => j.status === "running");
  const nextPending = !runningJob ? (jobs || []).find(j => j.status === "pending") : null;
  const featuredJob = runningJob || nextPending;

  const queuedJobs = (jobs || []).filter(j => j.status === "pending" && j.id !== featuredJob?.id);
  const pausedJobs = (jobs || []).filter(j => j.status === "paused");
  const completedJobs = (jobs || []).filter(j => j.status === "completed");
  const cancelledJobs = (jobs || []).filter(j => j.status === "cancelled");
  const historyJobs = [...completedJobs, ...cancelledJobs].slice(0, 10);

  const [queueOpen, setQueueOpen] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);

  if (!featuredJob && queuedJobs.length === 0 && pausedJobs.length === 0 && historyJobs.length === 0) return null;

  const totalQueued = queuedJobs.length + pausedJobs.length;

  return (
    <div className="space-y-3">
      {/* SEZIONE 1: Job Attivo */}
      {featuredJob && (
        <div>
          <p className={`text-sm font-medium mb-2 ${th.h2}`}>
            <Activity className="w-4 h-4 inline mr-1" />
            {featuredJob.status === "running" ? "Job Attivo" : "Prossimo in coda"}
          </p>
          <FeaturedJobCard job={featuredJob} pauseResume={pauseResume} updateSpeed={updateSpeed} />
        </div>
      )}

      {/* SEZIONE 2: Coda (collassabile) */}
      {totalQueued > 0 && (
        <div>
          <div className="flex items-center justify-between w-full">
            <button
              onClick={() => setQueueOpen(!queueOpen)}
              className={`flex items-center gap-1.5 text-sm font-medium py-1.5 ${th.dim} hover:opacity-80 transition-opacity`}
            >
              {queueOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              In coda ({totalQueued})
            </button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => deleteQueued.mutate()}
              disabled={deleteQueued.isPending}
              className={`h-6 text-[11px] px-2 ${th.btnStop}`}
            >
              <Trash2 className="w-3 h-3 mr-1" />
              {deleteQueued.isPending ? "Eliminando..." : "Elimina tutti"}
            </Button>
          </div>
          {queueOpen && (
            <div className={`${th.panel} border ${th.panelSlate} rounded-xl p-2 space-y-0.5 max-h-60 overflow-y-auto`}>
              {pausedJobs.map(job => (
                <QueueRow key={job.id} job={job} isPaused isDark={isDark} th={th} pauseResume={pauseResume} />
              ))}
              {queuedJobs.map(job => (
                <QueueRow key={job.id} job={job} isDark={isDark} th={th} pauseResume={pauseResume} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* SEZIONE 3: Cronologia (collassabile) */}
      {historyJobs.length > 0 && (
        <div>
          <div className="flex items-center justify-between w-full">
            <button
              onClick={() => setCompletedOpen(!completedOpen)}
              className={`flex items-center gap-1.5 text-sm font-medium py-1.5 ${th.dim} hover:opacity-80 transition-opacity`}
            >
              {completedOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              Cronologia ({completedJobs.length > 0 ? `${completedJobs.length} completati` : ""}{completedJobs.length > 0 && cancelledJobs.length > 0 ? ", " : ""}{cancelledJobs.length > 0 ? `${cancelledJobs.length} cancellati` : ""})
            </button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => purgeOld.mutate()}
              disabled={purgeOld.isPending}
              className={`h-6 text-[11px] px-2 ${th.btnStop}`}
            >
              <Trash2 className="w-3 h-3 mr-1" />
              {purgeOld.isPending ? "Pulendo..." : "Pulisci"}
            </Button>
          </div>
          {completedOpen && (
            <div className={`${th.panel} border ${th.panelSlate} rounded-xl p-2 space-y-0.5`}>
              {historyJobs.map(job => (
                <QueueRow key={job.id} job={job} isDark={isDark} th={th} pauseResume={pauseResume} isCompleted />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Riga compatta per coda e completati ── */
function QueueRow({ job, isDark, th, pauseResume, isPaused, isCompleted }: {
  job: DownloadJob;
  isDark: boolean;
  th: ReturnType<typeof t>;
  pauseResume: ReturnType<typeof usePauseResumeJob>;
  isPaused?: boolean;
  isCompleted?: boolean;
}) {
  const progress = job.total_count > 0 ? Math.round((job.current_index / job.total_count) * 100) : 0;

  return (
    <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs ${isDark ? "hover:bg-white/5" : "hover:bg-black/5"} transition-colors`}>
      <span className="text-base leading-none">{getCountryFlag(job.country_code)}</span>
      <span className={`flex-1 truncate ${th.body}`}>
        {job.country_name}
        <span className={`ml-1.5 ${th.dim}`}>{job.network_name}</span>
      </span>
      <span className={`font-mono tabular-nums ${th.dim}`}>{job.current_index}/{job.total_count}</span>
      {isPaused && (
        <Button size="sm" variant="ghost" className={`h-5 px-1.5 text-[10px] ${th.btnResume}`}
          onClick={() => pauseResume.mutate({ jobId: job.id, action: "resume" })}>
          <Play className="w-2.5 h-2.5" />
        </Button>
      )}
      {isCompleted && (
        <>
          <Badge className={`text-[10px] px-1.5 py-0 border-0 ${job.status === "completed" ? "bg-emerald-600 text-white" : "bg-slate-500 text-white"}`}>
            {job.status === "completed" ? <CheckCircle className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
          </Badge>
          {job.status === "completed" && (job.failed_ids as number[])?.length > 0 && (
            <Badge className="text-[10px] px-1.5 py-0 border-0 bg-orange-500 text-white">
              <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />{(job.failed_ids as number[]).length}
            </Badge>
          )}
          {job.status === "cancelled" && job.current_index < job.total_count && (
            <Button size="sm" variant="ghost" className={`h-5 px-1.5 text-[10px] ${th.btnResume}`}
              onClick={() => pauseResume.mutate({ jobId: job.id, action: "resume" })}>
              <Play className="w-2.5 h-2.5" />
            </Button>
          )}
        </>
      )}
      {!isPaused && !isCompleted && (
        <span className={`font-mono tabular-nums ${th.dim}`}>{progress}%</span>
      )}
    </div>
  );
}

/* ── Card grande per il job in evidenza ── */
function FeaturedJobCard({ job, pauseResume, updateSpeed }: {
  job: DownloadJob;
  pauseResume: ReturnType<typeof usePauseResumeJob>;
  updateSpeed: ReturnType<typeof useUpdateJobSpeed>;
}) {
  const isDark = useTheme();
  const th = t(isDark);
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

  const handleSpeedChange = (newDelay: number) => {
    updateSpeed.mutate({ jobId: job.id, delay_seconds: newDelay });
  };

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
            <Button size="sm" variant="ghost" onClick={() => setShowViewer(true)} className={`h-7 text-xs ${th.btnTest}`}>
              <List className="w-3 h-3 mr-1" /> Dati
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setShowTerminal(true)} className={`h-7 text-xs ${th.btnTest}`}>
            <Activity className="w-3 h-3 mr-1" /> Terminal
          </Button>
          {isActive && (
            <>
              <Button size="sm" variant="ghost" onClick={() => setShowSpeed(!showSpeed)} className={`h-7 ${th.btnPause}`}>
                <Settings2 className="w-3 h-3" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => pauseResume.mutate({ jobId: job.id, action: "pause" })} className={`h-7 text-xs ${th.btnPause}`}>
                <Pause className="w-3 h-3 mr-1" /> Pausa
              </Button>
              <Button size="sm" variant="ghost" onClick={() => pauseResume.mutate({ jobId: job.id, action: "cancel" })} className={`h-7 text-xs ${th.btnStop}`}>
                <Square className="w-3 h-3 mr-1" /> Stop
              </Button>
            </>
          )}
          {isPaused && (
            <>
              <Button size="sm" onClick={() => pauseResume.mutate({ jobId: job.id, action: "resume" })} className={`h-7 text-xs ${th.btnResume}`}>
                <Play className="w-3 h-3 mr-1" /> Riprendi
              </Button>
              <Button size="sm" variant="ghost" onClick={() => pauseResume.mutate({ jobId: job.id, action: "cancel" })} className={`h-7 text-xs ${th.btnStop}`}>
                <Square className="w-3 h-3 mr-1" /> Annulla
              </Button>
            </>
          )}
          {job.status === "cancelled" && job.current_index < job.total_count && (
            <Button size="sm" onClick={() => pauseResume.mutate({ jobId: job.id, action: "resume" })} className={`h-7 text-xs ${th.btnResume}`}>
              <Play className="w-3 h-3 mr-1" /> Riavvia
            </Button>
          )}
        </div>
      </div>

      <div className={`w-full h-1.5 rounded-full ${isDark ? "bg-slate-800" : "bg-slate-200"}`}>
        <div className={`h-full rounded-full transition-all ${isDark ? "bg-amber-500" : "bg-sky-500"}`} style={{ width: `${progress}%` }} />
      </div>

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
            <Timer className="w-3 h-3" /> Delay: <span className={`font-mono ${th.hi}`}>{localDelay}s</span>
          </label>
          <Slider value={[localDelay]} onValueChange={([v]) => setLocalDelay(v)} onValueCommit={([v]) => handleSpeedChange(v)} min={10} max={60} step={1} />
        </div>
      )}

      {job.error_message && <p className={`text-xs ${th.logErr}`}>⚠️ {job.error_message}</p>}
      {job.status === "completed" && job.completed_at && (
        <p className={`text-xs ${th.dim}`}>Completato il {new Date(job.completed_at).toLocaleString("it-IT")}</p>
      )}

      <JobDataViewer
        open={showViewer} onOpenChange={setShowViewer}
        processedIds={(job.processed_ids as number[]) || []}
        failedIds={(job.failed_ids as number[]) || []}
        countryName={job.country_name} countryCode={job.country_code}
        networkName={job.network_name} isDark={isDark}
        jobStatus={job.status}
      />
      <JobTerminalViewer
        open={showTerminal} onOpenChange={setShowTerminal}
        jobId={job.id} jobStatus={job.status}
        countryName={job.country_name} isDark={isDark}
      />
    </div>
  );
}
