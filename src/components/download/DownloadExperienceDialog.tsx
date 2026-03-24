import { useState, useMemo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useDownloadJobs } from "@/hooks/useDownloadJobs";
import { usePauseResumeJob } from "@/hooks/useDownloadJobs";
import { DownloadTerminalEmbed } from "@/components/download/DownloadTerminal";
import { DownloadAgendaView } from "@/components/download/DownloadAgendaView";
import { LiveProfileCards } from "@/components/download/LiveProfileCards";
import { getCountryFlag } from "@/lib/countries";
import { cn } from "@/lib/utils";
import {
  Terminal, ListTodo, Eye, Pause, Play, Square,
  Download, Globe, Users, CheckCircle2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type ViewMode = "terminal" | "agenda" | "live";

interface DownloadExperienceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStop: () => void;
}

const VIEW_OPTIONS: { key: ViewMode; icon: typeof Terminal; label: string }[] = [
  { key: "terminal", icon: Terminal, label: "Terminal" },
  { key: "agenda", icon: ListTodo, label: "Agenda" },
  { key: "live", icon: Eye, label: "Profili Live" },
];

export function DownloadExperienceDialog({ open, onOpenChange, onStop }: DownloadExperienceDialogProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("terminal");
  const { data: jobs } = useDownloadJobs();
  const pauseResume = usePauseResumeJob();

  const activeJob = useMemo(() => {
    if (!jobs) return null;
    return jobs.find(j => j.status === "running") || jobs.find(j => j.status === "pending") || jobs[0];
  }, [jobs]);

  const progress = activeJob
    ? activeJob.total_count > 0
      ? Math.round((activeJob.current_index / activeJob.total_count) * 100)
      : 0
    : 0;

  const isRunning = activeJob?.status === "running";
  const isPaused = activeJob?.status === "paused";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] p-0 gap-0 flex flex-col overflow-hidden bg-background/95 backdrop-blur-xl border-border/50 [&>button]:z-20">
        {/* ═══ HEADER ═══ */}
        <div className="flex-shrink-0 px-4 py-3 border-b border-border/50 glass-panel">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Download className="w-4.5 h-4.5 text-primary" />
              <h2 className="text-sm font-semibold">Download Experience</h2>
              {activeJob && (
                <div className="flex items-center gap-1.5">
                  <span className="text-lg">{getCountryFlag(activeJob.country_code)}</span>
                  <span className="text-xs text-muted-foreground">{activeJob.country_name}</span>
                </div>
              )}
              {isRunning && (
                <Badge className="text-[9px] px-2 py-0 h-4 bg-emerald-500/15 text-emerald-500 border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1" />
                  LIVE
                </Badge>
              )}
              {isPaused && (
                <Badge className="text-[9px] px-2 py-0 h-4 bg-amber-500/15 text-amber-500 border-amber-500/30">
                  PAUSA
                </Badge>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-1.5">
              {activeJob && isRunning && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={() => pauseResume.mutate({ jobId: activeJob.id, action: "pause" })}
                >
                  <Pause className="w-3 h-3" /> Pausa
                </Button>
              )}
              {activeJob && isPaused && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={() => pauseResume.mutate({ jobId: activeJob.id, action: "resume" })}
                >
                  <Play className="w-3 h-3" /> Riprendi
                </Button>
              )}
              {activeJob && (isRunning || isPaused) && (
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 text-xs gap-1"
                  onClick={onStop}
                >
                  <Square className="w-3 h-3" /> Stop
                </Button>
              )}
            </div>
          </div>

          {/* Progress bar + stats */}
          {activeJob && (
            <div className="flex items-center gap-3">
              <Progress value={progress} className="flex-1 h-2" />
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground shrink-0">
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {activeJob.current_index}/{activeJob.total_count}
                </span>
                <span className="flex items-center gap-1 text-emerald-500">
                  <CheckCircle2 className="w-3 h-3" />
                  {activeJob.contacts_found_count}
                </span>
                <span className="font-mono font-bold text-xs text-foreground">{progress}%</span>
              </div>
            </div>
          )}

          {/* View mode selector */}
          <div className="flex items-center gap-1 mt-2">
            {VIEW_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => setViewMode(opt.key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                  viewMode === opt.key
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <opt.icon className="w-3.5 h-3.5" />
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ═══ CONTENT AREA ═══ */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={viewMode}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="h-full"
            >
              {viewMode === "terminal" && <DownloadTerminalEmbed />}
              {viewMode === "agenda" && <DownloadAgendaView />}
              {viewMode === "live" && <LiveProfileCards />}
            </motion.div>
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
