import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Pause, Square, Play, ChevronDown, ChevronUp,
  Loader2, AlertTriangle,
} from "lucide-react";
import { getCountryFlag } from "@/lib/countries";
import {
  useDownloadJobs, usePauseResumeJob,
  type DownloadJob,
} from "@/hooks/useDownloadJobs";
import { useTheme, t } from "./theme";
import { useExtensionBridge } from "@/hooks/useExtensionBridge";

export function ActiveJobBar() {
  const isDark = useTheme();
  const th = t(isDark);
  const { data: jobs } = useDownloadJobs();
  const pauseResume = usePauseResumeJob();
  const [expanded, setExpanded] = useState(false);
  const { isAvailable: extensionAvailable } = useExtensionBridge();

  const activeJobs = (jobs || []).filter(
    (j) => j.status === "running" || j.status === "pending" || j.status === "paused"
  );

  if (activeJobs.length === 0) return null;

  const mainJob = activeJobs[0];
  const progress =
    mainJob.total_count > 0
      ? (mainJob.current_index / mainJob.total_count) * 100
      : 0;
  const isRunning = mainJob.status === "running" || mainJob.status === "pending";
  const isPaused = mainJob.status === "paused";

  return (
    <div className="flex-shrink-0 mx-4 mb-2">
      <div
        className={`rounded-2xl border px-4 py-3 ${
          isDark
            ? "bg-white/[0.04] backdrop-blur-xl border-amber-500/40"
            : "bg-white/60 backdrop-blur-xl border-sky-300 shadow-sm"
        }`}
      >
        {/* Row 1: Status badge + percentage + actions */}
        <div className="flex items-center gap-3">
          {/* Status badge */}
          <div className="flex items-center gap-2 min-w-0">
            {isRunning ? (
              <span className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${
                isDark ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
              }`}>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                ATTIVO
              </span>
            ) : isPaused ? (
              <span className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${
                isDark ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" : "bg-yellow-50 text-yellow-700 border border-yellow-200"
              }`}>
                <span className="w-2 h-2 rounded-full bg-yellow-500" />
                IN PAUSA
              </span>
            ) : null}
            {!extensionAvailable && (
              <span className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${isDark ? "bg-red-500/20 text-red-300 border border-red-500/30" : "bg-red-50 text-red-600 border border-red-200"}`}>
                <AlertTriangle className="w-3 h-3" /> Estensione mancante
              </span>
            )}
          </div>

          {/* Big percentage — centered */}
          <div className="flex-1 text-center">
            <span className={`text-2xl font-black font-mono ${isDark ? "text-amber-400" : "text-sky-600"}`}>
              {Math.round(progress)}%
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {isRunning && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => pauseResume.mutate({ jobId: mainJob.id, action: "pause" })}
                  className={`h-7 w-7 p-0 ${th.btnPause}`}
                >
                  <Pause className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => pauseResume.mutate({ jobId: mainJob.id, action: "cancel" })}
                  className={`h-7 w-7 p-0 ${th.btnStop}`}
                >
                  <Square className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
            {isPaused && (
              <Button
                size="sm"
                onClick={() => pauseResume.mutate({ jobId: mainJob.id, action: "resume" })}
                className={`h-7 text-xs px-3 ${th.btnResume}`}
              >
                <Play className="w-3.5 h-3.5 mr-1" /> Riprendi
              </Button>
            )}
            {activeJobs.length > 1 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className={`p-1 rounded-lg transition-colors ${th.hover}`}
              >
                {expanded ? (
                  <ChevronUp className={`w-3.5 h-3.5 ${th.dim}`} />
                ) : (
                  <ChevronDown className={`w-3.5 h-3.5 ${th.dim}`} />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Full-width progress bar */}
        <div className={`mt-2 w-full h-2.5 rounded-full ${isDark ? "bg-slate-800" : "bg-slate-200"}`}>
          <div
            className={`h-full rounded-full transition-all ${isDark ? "bg-amber-500" : "bg-sky-500"}`}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Row 3: Details line */}
        <div className={`mt-1.5 flex items-center gap-2 text-xs ${th.dim}`}>
          <span className="font-medium">
            {getCountryFlag(mainJob.country_code)} {mainJob.country_name}
          </span>
          <span>·</span>
          <span className="font-mono">
            {mainJob.current_index}/{mainJob.total_count}
          </span>
          {mainJob.last_processed_company && (
            <>
              <span>·</span>
              <span className="truncate max-w-[200px]">
                {mainJob.last_processed_company}
              </span>
            </>
          )}
          {(mainJob.contacts_found_count > 0 || mainJob.contacts_missing_count > 0) && (
            <>
              <span className="ml-auto font-mono text-[11px]">
                <span className="text-emerald-500">✓{mainJob.contacts_found_count}</span>
                {" "}
                <span className="text-red-400">✗{mainJob.contacts_missing_count}</span>
              </span>
            </>
          )}
          {isRunning && (
            <Loader2 className={`w-3 h-3 animate-spin ml-1 ${isDark ? "text-amber-400" : "text-sky-500"}`} />
          )}
        </div>

        {mainJob.error_message && (
          <div className={`mt-1 text-[10px] truncate ${isDark ? "text-amber-300/80" : "text-amber-600"}`}>
            ⚠ {mainJob.error_message}
          </div>
        )}

        {/* Expanded: other jobs */}
        {expanded && activeJobs.length > 1 && (
          <div className={`mt-2 pt-2 border-t space-y-2 ${isDark ? "border-white/[0.08]" : "border-slate-200/60"}`}>
            {activeJobs.slice(1).map((job) => (
              <ExpandedJobRow key={job.id} job={job} pauseResume={pauseResume} isDark={isDark} th={th} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ExpandedJobRow({
  job, pauseResume, isDark, th,
}: {
  job: DownloadJob;
  pauseResume: ReturnType<typeof usePauseResumeJob>;
  isDark: boolean;
  th: ReturnType<typeof t>;
}) {
  const progress = job.total_count > 0 ? (job.current_index / job.total_count) * 100 : 0;
  const isRunning = job.status === "running" || job.status === "pending";
  const isPaused = job.status === "paused";

  return (
    <div className="flex items-center gap-3">
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
        isRunning ? `animate-pulse ${isDark ? "bg-amber-400" : "bg-sky-500"}` : "bg-yellow-400"
      }`} />
      <span className={`text-xs flex-shrink-0 ${th.body}`}>
        {getCountryFlag(job.country_code)} {job.country_name}
      </span>
      <span className={`text-[11px] font-mono ${th.dim}`}>
        {Math.round(progress)}%
      </span>
      <div className={`flex-1 h-1 rounded-full ${isDark ? "bg-slate-800" : "bg-slate-200"}`}>
        <div
          className={`h-full rounded-full ${isDark ? "bg-amber-500" : "bg-sky-500"}`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className={`text-[11px] font-mono ${th.dim}`}>
        {job.current_index}/{job.total_count}
      </span>
      <div className="flex gap-1 flex-shrink-0">
        {isRunning && (
          <>
            <Button size="sm" variant="ghost" onClick={() => pauseResume.mutate({ jobId: job.id, action: "pause" })} className={`h-5 w-5 p-0 ${th.btnPause}`}>
              <Pause className="w-2.5 h-2.5" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => pauseResume.mutate({ jobId: job.id, action: "cancel" })} className={`h-5 w-5 p-0 ${th.btnStop}`}>
              <Square className="w-2.5 h-2.5" />
            </Button>
          </>
        )}
        {isPaused && (
          <Button size="sm" onClick={() => pauseResume.mutate({ jobId: job.id, action: "resume" })} className={`h-5 text-[10px] px-1.5 ${th.btnResume}`}>
            <Play className="w-2.5 h-2.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
