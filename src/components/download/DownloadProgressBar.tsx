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
  idle: "text-muted-foreground",
  login: "text-primary",
  discover: "text-primary",
  compare: "text-primary",
  download: "text-emerald-400",
  done: "text-emerald-500",
  error: "text-destructive",
  paused: "text-muted-foreground",
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
              "bg-primary/10 border-primary/30"
            )}
          >
            <Pause className="w-4 h-4 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-xs font-bold text-foreground">
                {getCountryFlag(job.countryCode)} {job.countryName}
              </span>
              <span className="text-[10px] ml-2 text-muted-foreground">
                {job.doneCount}/{job.totalCount} · {job.pendingCount} rimanenti
              </span>
            </div>
            {onResume && (
              <Button
                size="sm"
                onClick={() => onResume(job.countryCode, job.countryName)}
                className="h-7 text-xs px-3"
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
        isDark ? "bg-white/[0.04] backdrop-blur-xl border-primary/40" : "bg-card/60 backdrop-blur-xl border-primary/30 shadow-sm"
      )}>
        {/* Row 1: Phase badge + percentage + controls */}
        <div className="flex items-center gap-2">
          {/* Phase badge */}
          <span className={cn(
            "flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border",
            phase === "error"
              ? "bg-destructive/15 border-destructive/30 text-destructive"
              : phase === "done"
                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-500"
                : "bg-primary/15 border-primary/30 text-primary"
          )}>
            {phase === "done" && <CheckCircle2 className="w-3 h-3" />}
            {phase === "error" && <AlertTriangle className="w-3 h-3" />}
            {isRunning && phase !== "done" && phase !== "error" && <Loader2 className="w-3 h-3 animate-spin" />}
            {PHASE_LABELS[phase]}
          </span>

          {/* Claude V8 badge */}
          <span className={cn(
            "text-[9px] px-1.5 py-0.5 rounded-full border",
            "bg-primary/10 border-primary/20 text-primary"
          )}>
            🤖 V8
          </span>

          {/* Country */}
          {countryCode && (
            <span className="text-xs font-medium text-foreground">
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
                className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10"
                title="Ferma"
              >
                <Square className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Row 2: Progress bar */}
        {showBar && (
          <div className="mt-1.5 w-full h-2 rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                phase === "done" ? "bg-emerald-500" : phase === "paused" ? "bg-muted-foreground" : "bg-primary"
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}

        {/* Row 3: Message + counter */}
        <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
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
