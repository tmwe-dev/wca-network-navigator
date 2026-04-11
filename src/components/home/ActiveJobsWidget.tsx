import { useState, useCallback } from "react";
import { Download, Loader2, CheckCircle2, AlertTriangle, Pause, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import type { DownloadJob } from "@/hooks/useDownloadJobs";
import { createLogger } from "@/lib/log";

const log = createLogger("ActiveJobsWidget");

function countryFlag(code: string) {
  if (!code || code.length < 2) return "🏳️";
  const upper = code.toUpperCase().slice(0, 2);
  return String.fromCodePoint(...[...upper].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

function JobStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "running": return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
    case "completed": return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
    case "failed": return <AlertTriangle className="h-4 w-4 text-destructive" />;
    case "paused": return <Pause className="h-4 w-4 text-amber-400" />;
    default: return <Download className="h-4 w-4 text-muted-foreground" />;
  }
}

const STATUS_LABELS: Record<string, string> = {
  running: "In corso", completed: "Completato", failed: "Errore",
  paused: "In pausa", pending: "In coda",
};

interface Props { jobs: DownloadJob[]; }

export function ActiveJobsWidget({ jobs }: Props) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("dismissed_job_cards");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch (e) { log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) }); return new Set(); }
  });

  const dismiss = useCallback((id: string) => {
    setDismissedIds(prev => {
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem("dismissed_job_cards", JSON.stringify([...next]));
      return next;
    });
  }, []);

  const activeJobs = jobs.filter((j) => ["running", "pending"].includes(j.status));
  const recentDone = jobs.filter((j) => ["completed", "failed"].includes(j.status)).slice(0, 2);
  const display = [...activeJobs, ...recentDone].slice(0, 5)
    .filter(j => !dismissedIds.has(j.id) || ["running", "pending"].includes(j.status));

  if (display.length === 0) return null;

  return (
    <section className="glass-panel rounded-xl border border-border/60 p-4 space-y-3">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        <Download className="h-3.5 w-3.5 text-primary/70" />
        Download attivi
      </div>
      <div className="space-y-2.5">
        {display.map((job) => {
          const progress = job.total_count > 0 ? Math.round((job.current_index / job.total_count) * 100) : 0;
          const isActive = job.status === "running";
          const canDismiss = ["completed", "failed", "cancelled"].includes(job.status);

          return (
            <div key={job.id} className={cn(
              "rounded-lg border p-3 space-y-2 transition-colors",
              isActive ? "border-primary/30 bg-primary/5" : "border-border/40 bg-muted/20"
            )}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">{countryFlag(job.country_code)}</span>
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      {job.country_name}
                      {job.network_name && job.network_name !== "Tutti" && (
                        <span className="ml-1.5 text-xs text-muted-foreground">· {job.network_name}</span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {job.current_index}/{job.total_count} profili · {job.contacts_found_count} contatti trovati
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <JobStatusIcon status={job.status} />
                  <span className={cn(
                    "text-[10px] font-medium",
                    job.status === "running" ? "text-primary" :
                    job.status === "failed" ? "text-destructive" :
                    job.status === "completed" ? "text-emerald-400" :
                    "text-muted-foreground"
                  )}>
                    {STATUS_LABELS[job.status] ?? job.status}
                  </span>
                  {canDismiss && (
                    <button onClick={() => dismiss(job.id)} className="ml-1 p-0.5 rounded hover:bg-muted/40 text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
              {(isActive || job.status === "pending") && (
                <div className="space-y-1">
                  <Progress value={progress} className="h-1.5" />
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{progress}%</span>
                    {job.last_processed_company && <span className="truncate ml-2">{job.last_processed_company}</span>}
                  </div>
                </div>
              )}
              {job.error_message && (
                <div className="text-[10px] text-destructive/80 truncate">⚠️ {job.error_message}</div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
