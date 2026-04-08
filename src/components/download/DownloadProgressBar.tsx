/**
 * DownloadProgressBar — Widget compatto per il download Claude Engine V8
 * 🤖 Mostra fase, progresso, messaggi e controlli stop/riprendi
 */

import { Button } from "@/components/ui/button";
import { Loader2, Square, Play, RotateCcw, CheckCircle2, AlertTriangle, Pause } from "lucide-react";
import { getCountryFlag } from "@/lib/countries";
import type { SuspendedJob } from "@/lib/localDirectory";
import { cn } from "@/lib/utils";

export interface DownloadProgress {
  phase: "idle" | "login" | "discover" | "compare" | "download" | "done" | "error" | "paused";
  current: number;
  total: number;
  message: string;
  countryCode?: string;
  /** ID del job server-side (se attivo) */
  serverJobId?: string;
}

interface DownloadProgressBarProps {
  progress: DownloadProgress;
  isRunning: boolean;
  onStop: () => void;
  onResume?: (countryCode: string, countryName: string) => void;
  suspendedJobs?: SuspendedJob[];
  isDark?: boolean;
}

const PHASE_LABELS: Record<DownloadProgress["phase"], string> = {
  idle: "Pronto",
  login: "Login",
  discover: "Scoperta",
  compare: "Confronto",
  download: "Download",
  done: "Completato",
  error: "Errore",
  paused: "In pausa",
};

const PHASE_COLORS: Record<DownloadProgress["phase"], string> = {
  idle: "text-slate-400",
  login: "text-blue-400",
  discover: "text-cyan-400",
  compare: "text-amber-400",
  download: "text-emerald-400",
  done: "text-emerald-500",
  error: "text-red-400",
  paused: "text-yellow-400",
};

export function DownloadProgressBar({
  progress, isRunning, onStop, onResume, suspendedJobs = [], isDark = true,
}: DownloadProgressBarProps) {
  const { phase, current, total, message, countryCode } = progress;
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  const showBar = phase === "download" || phase === "done" || phase === "paused";
  const isActive = phase !== "idle";

  // Se idle e ci sono job sospesi, mostra banner ripresa
  if (!isActive && suspendedJobs.length > 0) {
    return (
      <div className="flex-shrink-0 mx-4 mb-2">
        {suspendedJobs.map((job) => (
          <div
            key={job.countryCode}
            className={cn(
              "rounded-xl border px-3 py-2 flex items-center gap-3 mb-1",
              isDark ? "bg-yellow-500/10 border-yellow-500/30" : "bg-yellow-50 border-yellow-200"
            )}
          >
            <Pause className="w-4 h-4 text-yellow-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span className={cn("text-xs font-bold", isDark ? "text-yellow-300" : "text-yellow-700")}>
                {getCountryFlag(job.countryCode)} {job.countryName}
              </span>
              <span className={cn("text-[10px] ml-2", isDark ? "text-yellow-400/70" : "text-yellow-600")}>
                {job.doneCount}/{job.totalCount} · {job.pendingCount} rimanenti
              </span>
            </div>
            {onResume && (
              <Button
                size="sm"
                onClick={() => onResume(job.countryCode, job.countryName)}
                className={cn("h-7 text-xs px-3", isDark ? "bg-yellow-600 hover:bg-yellow-500 text-white" : "bg-yellow-500 hover:bg-yellow-400 text-white")}
              >
                <Play className="w-3.5 h-3.5 mr-1" /> Riprendi
              </Button>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (!isActive) return null;

  return (
    <div className="flex-shrink-0 mx-4 mb-2">
      <div className={cn(
        "rounded-xl border px-3 py-2",
        isDark ? "bg-white/[0.04] backdrop-blur-xl border-amber-500/40" : "bg-white/60 backdrop-blur-xl border-sky-300 shadow-sm"
      )}>
        {/* Row 1: Phase badge + percentage + controls */}
        <div className="flex items-center gap-2">
          {/* Phase badge */}
          <span className={cn(
            "flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border",
            phase === "error"
              ? isDark ? "bg-red-500/15 border-red-500/30 text-red-400" : "bg-red-50 border-red-200 text-red-600"
              : phase === "done"
                ? isDark ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" : "bg-emerald-50 border-emerald-200 text-emerald-600"
                : isDark ? "bg-amber-500/15 border-amber-500/30 text-amber-300" : "bg-amber-50 border-amber-200 text-amber-600"
          )}>
            {phase === "done" && <CheckCircle2 className="w-3 h-3" />}
            {phase === "error" && <AlertTriangle className="w-3 h-3" />}
            {isRunning && phase !== "done" && phase !== "error" && <Loader2 className="w-3 h-3 animate-spin" />}
            {PHASE_LABELS[phase]}
          </span>

          {/* Claude V8 badge */}
          <span className={cn(
            "text-[9px] px-1.5 py-0.5 rounded-full border",
            isDark ? "bg-amber-500/10 border-amber-500/20 text-amber-400" : "bg-amber-50 border-amber-200 text-amber-600"
          )}>
            🤖 V8
          </span>

          {/* Country */}
          {countryCode && (
            <span className={cn("text-xs font-medium", isDark ? "text-slate-300" : "text-slate-600")}>
              {getCountryFlag(countryCode)}
            </span>
          )}

          {/* Percentage */}
          {showBar && (
            <span className={cn("text-lg font-black font-mono ml-auto", PHASE_COLORS[phase])}>
              {pct}%
            </span>
          )}

          {/* Controls */}
          <div className="flex items-center gap-1 ml-auto flex-shrink-0">
            {isRunning && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onStop}
                className={cn("h-6 w-6 p-0", isDark ? "text-red-400 hover:bg-red-500/20" : "text-red-500 hover:bg-red-50")}
                title="Ferma"
              >
                <Square className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Row 2: Progress bar */}
        {showBar && (
          <div className={cn("mt-1.5 w-full h-2 rounded-full", isDark ? "bg-slate-800" : "bg-slate-200")}>
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                phase === "done" ? "bg-emerald-500" : phase === "paused" ? "bg-yellow-500" : isDark ? "bg-amber-500" : "bg-sky-500"
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}

        {/* Row 3: Message + counter */}
        <div className={cn("mt-1 flex items-center gap-2 text-[11px]", isDark ? "text-slate-400" : "text-slate-500")}>
          <span className="truncate flex-1">{message}</span>
          {showBar && total > 0 && (
            <span className="font-mono font-bold tabular-nums flex-shrink-0">
              {current}/{total}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
