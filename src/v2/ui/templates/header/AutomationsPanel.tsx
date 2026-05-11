/**
 * AutomationsPanel — Pannello top bar con stato dei cron job e ultimi run.
 * Sorgenti dati: RPC `cron_job_status()` + `cron_recent_runs(limit)` (pg_cron, SECURITY DEFINER).
 * Refetch ogni 30s. Read-only: il toggle pausa cron resta in StatusPill.
 */
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Cog, CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";
import { listCronJobStatus, listCronRecentRuns, type CronJobStatus, type CronRunRow } from "@/data/cronJobs";
import { queryKeys } from "@/lib/queryKeys";

function statusIcon(status: string | null): React.ReactNode {
  const s = (status ?? "").toLowerCase();
  if (s === "succeeded" || s === "success") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
  if (s === "failed" || s === "error") return <XCircle className="h-3.5 w-3.5 text-destructive" />;
  if (s === "running" || s === "starting") return <Clock className="h-3.5 w-3.5 text-primary animate-pulse" />;
  if (!status) return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
  return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "mai";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "ora";
  if (m < 60) return `${m}m fa`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h fa`;
  const d = Math.floor(h / 24);
  return `${d}g fa`;
}

export function AutomationsPanel(): React.ReactElement {
  const { data: jobs = [], isLoading: loadingJobs } = useQuery<CronJobStatus[]>({
    queryKey: queryKeys.cronJobs.list,
    queryFn: listCronJobStatus,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const { data: runs = [], isLoading: loadingRuns } = useQuery<CronRunRow[]>({
    queryKey: queryKeys.cronJobs.runs(30),
    queryFn: () => listCronRecentRuns(30),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const totalActive = jobs.filter((j) => j.active).length;
  const failed24h = runs.filter((r) => {
    const s = (r.status ?? "").toLowerCase();
    if (s !== "failed" && s !== "error") return false;
    return Date.now() - new Date(r.start_time).getTime() < 24 * 3600_000;
  }).length;

  const dot = failed24h > 0 ? "bg-amber-500" : totalActive > 0 ? "bg-emerald-500" : "bg-muted";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs"
          aria-label="Automazioni · stato cron job"
          title="Automazioni · stato cron job"
        >
          <Cog className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="hidden xl:inline text-muted-foreground">Automazioni</span>
          <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
          {failed24h > 0 && (
            <Badge variant="outline" className="h-4 px-1 text-[10px] text-amber-600 border-amber-500/40">
              {failed24h}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[30rem] max-w-[calc(100vw-1rem)] p-3 space-y-3">
        <div className="flex items-center justify-between border-b border-border/40 pb-2">
          <div className="flex items-center gap-2">
            <Cog className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Automazioni · cron job</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary" className="text-[10px]">{totalActive} attivi</Badge>
            {failed24h > 0 && (
              <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/40">
                {failed24h} falliti 24h
              </Badge>
            )}
          </div>
        </div>

        <section>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Job schedulati</div>
          <ScrollArea className="h-[180px] pr-2">
            {loadingJobs && <div className="text-xs text-muted-foreground">Caricamento…</div>}
            {!loadingJobs && jobs.length === 0 && <div className="text-xs text-muted-foreground">Nessun cron job configurato.</div>}
            <ul className="space-y-1">
              {jobs.map((j) => (
                <li key={j.jobname} className="flex items-center justify-between gap-2 text-xs rounded-md px-1.5 py-1 hover:bg-muted/50">
                  <div className="flex items-center gap-2 min-w-0">
                    {statusIcon(j.last_status)}
                    <span className={`truncate font-medium ${j.active ? "" : "text-muted-foreground line-through"}`} title={j.jobname}>
                      {j.jobname}
                    </span>
                    <span className="text-[10px] text-muted-foreground tabular-nums shrink-0" title={`Schedule: ${j.schedule}`}>
                      {j.schedule}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums" title={j.last_run ?? ""}>
                    {relativeTime(j.last_run)}
                  </span>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </section>

        <section className="border-t border-border/40 pt-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Ultimi run</div>
          <ScrollArea className="h-[160px] pr-2">
            {loadingRuns && <div className="text-xs text-muted-foreground">Caricamento…</div>}
            {!loadingRuns && runs.length === 0 && <div className="text-xs text-muted-foreground">Nessun run registrato.</div>}
            <ul className="space-y-1">
              {runs.map((r, idx) => (
                <li key={`${r.jobid}-${r.start_time}-${idx}`} className="flex items-center justify-between gap-2 text-xs rounded-md px-1.5 py-1 hover:bg-muted/50">
                  <div className="flex items-center gap-2 min-w-0">
                    {statusIcon(r.status)}
                    <span className="truncate" title={r.return_message ?? r.status}>
                      {r.jobname ?? `job ${r.jobid}`}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums" title={r.start_time}>
                    {relativeTime(r.start_time)}
                  </span>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </section>
      </PopoverContent>
    </Popover>
  );
}