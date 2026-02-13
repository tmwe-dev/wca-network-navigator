import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Activity, Pause, Square, Play, ChevronDown, ChevronUp,
  Mail, Phone, XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getCountryFlag } from "@/lib/countries";
import {
  useDownloadJobs, usePauseResumeJob,
  type DownloadJob,
} from "@/hooks/useDownloadJobs";
import { useTheme, t } from "./theme";

export function ActiveJobBar() {
  const isDark = useTheme();
  const th = t(isDark);
  const { data: jobs } = useDownloadJobs();
  const pauseResume = usePauseResumeJob();
  const [expanded, setExpanded] = useState(false);

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
        className={`rounded-2xl border px-4 py-2.5 ${
          isDark
            ? "bg-white/[0.04] backdrop-blur-xl border-amber-500/20"
            : "bg-white/60 backdrop-blur-xl border-sky-200/60 shadow-sm"
        }`}
      >
        {/* Compact bar */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                isRunning
                  ? `animate-pulse ${isDark ? "bg-amber-400" : "bg-sky-500"}`
                  : isPaused
                  ? "bg-yellow-400"
                  : "bg-slate-400"
              }`}
            />
            <Activity className={`w-3.5 h-3.5 flex-shrink-0 ${th.hi}`} />
            <span className={`text-xs font-medium truncate ${th.h2}`}>
              {activeJobs.length} job attiv{activeJobs.length === 1 ? "o" : "i"}
            </span>
            <span className={`text-xs truncate ${th.dim}`}>
              {getCountryFlag(mainJob.country_code)} {mainJob.country_name}
              {" · "}
              {mainJob.current_index}/{mainJob.total_count}
            </span>
          </div>

          {/* Progress bar */}
          <div
            className={`w-24 h-1.5 rounded-full flex-shrink-0 ${
              isDark ? "bg-slate-800" : "bg-slate-200"
            }`}
          >
            <div
              className={`h-full rounded-full transition-all ${
                isDark ? "bg-amber-500" : "bg-sky-500"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Last processed */}
          {mainJob.last_processed_company && (
            <span className={`text-[11px] truncate max-w-[140px] ${th.dim}`}>
              {mainJob.last_processed_company}
            </span>
          )}

          {/* Contact result badge */}
          {mainJob.last_contact_result && (() => {
            const r = mainJob.last_contact_result;
            if (r === "email+phone")
              return (
                <Badge className="text-[10px] px-1.5 py-0 bg-emerald-600 text-white border-0">
                  <Mail className="w-3 h-3" />
                  <Phone className="w-3 h-3" />
                </Badge>
              );
            if (r === "email_only")
              return (
                <Badge className="text-[10px] px-1.5 py-0 bg-blue-500 text-white border-0">
                  <Mail className="w-3 h-3" />
                </Badge>
              );
            if (r === "phone_only")
              return (
                <Badge className="text-[10px] px-1.5 py-0 bg-blue-500 text-white border-0">
                  <Phone className="w-3 h-3" />
                </Badge>
              );
            return (
              <Badge className="text-[10px] px-1.5 py-0 bg-red-500/80 text-white border-0">
                <XCircle className="w-3 h-3" />
              </Badge>
            );
          })()}

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {isRunning && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    pauseResume.mutate({ jobId: mainJob.id, action: "pause" })
                  }
                  className={`h-6 w-6 p-0 ${th.btnPause}`}
                >
                  <Pause className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    pauseResume.mutate({ jobId: mainJob.id, action: "cancel" })
                  }
                  className={`h-6 w-6 p-0 ${th.btnStop}`}
                >
                  <Square className="w-3 h-3" />
                </Button>
              </>
            )}
            {isPaused && (
              <Button
                size="sm"
                onClick={() =>
                  pauseResume.mutate({ jobId: mainJob.id, action: "resume" })
                }
                className={`h-6 text-[10px] px-2 ${th.btnResume}`}
              >
                <Play className="w-3 h-3 mr-0.5" /> Riprendi
              </Button>
            )}
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
          </div>
        </div>

        {/* Expanded: all jobs */}
        {expanded && activeJobs.length > 0 && (
          <div className={`mt-2 pt-2 border-t space-y-2 ${isDark ? "border-white/[0.08]" : "border-slate-200/60"}`}>
            {activeJobs.map((job) => (
              <ExpandedJobRow key={job.id} job={job} pauseResume={pauseResume} isDark={isDark} th={th} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ExpandedJobRow({
  job,
  pauseResume,
  isDark,
  th,
}: {
  job: DownloadJob;
  pauseResume: ReturnType<typeof usePauseResumeJob>;
  isDark: boolean;
  th: ReturnType<typeof t>;
}) {
  const progress =
    job.total_count > 0 ? (job.current_index / job.total_count) * 100 : 0;
  const isRunning = job.status === "running" || job.status === "pending";
  const isPaused = job.status === "paused";
  const found = job.contacts_found_count || 0;
  const missing = job.contacts_missing_count || 0;
  const total = found + missing;
  const pct = total > 0 ? Math.round((found / total) * 100) : 0;

  return (
    <div className="flex items-center gap-3">
      <div
        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
          isRunning
            ? `animate-pulse ${isDark ? "bg-amber-400" : "bg-sky-500"}`
            : "bg-yellow-400"
        }`}
      />
      <span className={`text-xs flex-shrink-0 ${th.body}`}>
        {getCountryFlag(job.country_code)} {job.country_name}
      </span>
      <span className={`text-[11px] ${th.dim}`}>
        {job.current_index}/{job.total_count}
      </span>
      <div
        className={`flex-1 h-1 rounded-full ${
          isDark ? "bg-slate-800" : "bg-slate-200"
        }`}
      >
        <div
          className={`h-full rounded-full ${isDark ? "bg-amber-500" : "bg-sky-500"}`}
          style={{ width: `${progress}%` }}
        />
      </div>
      {total > 0 && (
        <span className={`text-[10px] font-mono ${th.dim}`}>
          <span className="text-emerald-500">{found}</span>/{total} ({pct}%)
        </span>
      )}
      {job.last_processed_company && (
        <span className={`text-[10px] truncate max-w-[100px] ${th.dim}`}>
          {job.last_processed_company}
        </span>
      )}
      <div className="flex gap-1 flex-shrink-0">
        {isRunning && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                pauseResume.mutate({ jobId: job.id, action: "pause" })
              }
              className={`h-5 w-5 p-0 ${th.btnPause}`}
            >
              <Pause className="w-2.5 h-2.5" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                pauseResume.mutate({ jobId: job.id, action: "cancel" })
              }
              className={`h-5 w-5 p-0 ${th.btnStop}`}
            >
              <Square className="w-2.5 h-2.5" />
            </Button>
          </>
        )}
        {isPaused && (
          <Button
            size="sm"
            onClick={() =>
              pauseResume.mutate({ jobId: job.id, action: "resume" })
            }
            className={`h-5 text-[10px] px-1.5 ${th.btnResume}`}
          >
            <Play className="w-2.5 h-2.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
