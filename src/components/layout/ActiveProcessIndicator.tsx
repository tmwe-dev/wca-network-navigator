import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Download, Wand2, Search, Mail, Pause, Play, X, ChevronDown, ChevronUp } from "lucide-react";
import { useActiveProcesses, type ActiveProcess } from "@/hooks/useActiveProcesses";
import { usePauseResumeJob } from "@/hooks/useDownloadJobs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const typeIcons: Record<ActiveProcess["type"], typeof Download> = {
  download: Download,
  alias: Wand2,
  deep_search: Search,
  email_queue: Mail,
};

export function ActiveProcessIndicator() {
  const { processes, hasActive, runningCount, totalCount, overallProgress } = useActiveProcesses();
  const [expanded, setExpanded] = useState(false);
  const pauseResume = usePauseResumeJob();

  const mainProcess = hasActive ? processes[0] : null;
  const Icon = mainProcess ? (typeIcons[mainProcess.type] || Activity) : Activity;

  const handleAction = (proc: ActiveProcess, action: "pause" | "resume" | "cancel") => {
    if (proc.type !== "download") return;
    const jobId = proc.id.replace("dl-", "");
    pauseResume.mutate({ jobId, action });
  };

  return (
    <div className="relative">
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <button
            onClick={() => hasActive && setExpanded((v) => !v)}
            className={cn(
              "flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all relative overflow-hidden",
              hasActive
                ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 cursor-pointer"
                : "border-border bg-muted/30 text-muted-foreground cursor-default"
            )}
          >
            <span className="relative flex-shrink-0">
              <Icon className="w-3.5 h-3.5" />
              {hasActive && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </span>
            {hasActive ? (
              <>
                <span className="tabular-nums">
                  {runningCount > 0 ? `${runningCount} attivo` : `${totalCount} in coda`}
                </span>
                {mainProcess?.countdownLabel && (
                  <span className="tabular-nums text-primary/70 text-[10px]">{mainProcess.countdownLabel}</span>
                )}
                {mainProcess?.progress !== undefined && mainProcess.progress > 0 && !mainProcess?.countdownLabel && (
                  <span className="tabular-nums text-primary/70">{mainProcess.progress}%</span>
                )}
                {processes.length > 1 && (
                  expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                )}
              </>
            ) : (
              <span className="hidden sm:inline">Idle</span>
            )}

            {/* Mini progress bar at bottom */}
            {hasActive && overallProgress !== undefined && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary/10">
                <motion.div
                  className="h-full bg-primary/60 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${overallProgress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {hasActive
            ? `${processes.length} processo/i attivo/i — clicca per dettagli`
            : "Nessun processo attivo"}
        </TooltipContent>
      </Tooltip>

      <AnimatePresence>
        {expanded && hasActive && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 mt-1 z-50 w-80 rounded-xl border border-border bg-popover shadow-lg overflow-hidden"
          >
            <div className="px-3 py-2 border-b border-border bg-muted/50">
              <span className="text-[11px] font-semibold text-foreground">Processi Attivi</span>
            </div>
            <div className="max-h-60 overflow-auto divide-y divide-border">
              {processes.map((proc) => (
                <ProcessRow key={proc.id} process={proc} onAction={handleAction} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ProcessRow({ process, onAction }: { process: ActiveProcess; onAction: (proc: ActiveProcess, action: "pause" | "resume" | "cancel") => void }) {
  const Icon = typeIcons[process.type] || Activity;
  const isPaused = process.status === "paused";
  const isDownload = process.type === "download";

  return (
    <div className="flex items-center gap-2.5 px-3 py-2">
      <div className={cn(
        "flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center",
        isPaused ? "bg-primary/15 text-primary" : "bg-primary/10 text-primary"
      )}>
        {isPaused ? <Pause className="w-3 h-3" /> : <Icon className="w-3 h-3" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-foreground truncate">{process.label}</span>
          {process.detail && (
            <span className="text-[10px] font-mono text-muted-foreground ml-2">{process.detail}</span>
          )}
        </div>
        {process.progress !== undefined && (
          <div className="mt-1 h-1 w-full rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                isPaused ? "bg-primary" : "bg-primary"
              )}
              style={{ width: `${process.progress}%` }}
            />
          </div>
        )}
        {process.errorMessage && isPaused && (
          <p className="text-[10px] text-primary mt-0.5 truncate">{process.errorMessage}</p>
        )}
      </div>

      {/* Controls */}
      {isDownload && (
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onAction(process, isPaused ? "resume" : "pause"); }}
            className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title={isPaused ? "Riprendi" : "Pausa"}
          >
            {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onAction(process, "cancel"); }}
            className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            title="Annulla"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {!isDownload && (
        <span className={cn(
          "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full",
          isPaused
            ? "bg-primary/15 text-primary"
            : process.status === "running"
              ? "bg-emerald-500/15 text-emerald-500"
              : "bg-muted text-muted-foreground"
        )}>
          {isPaused ? "PAUSA" : process.status === "running" ? "ATTIVO" : "CODA"}
        </span>
      )}
    </div>
  );
}
