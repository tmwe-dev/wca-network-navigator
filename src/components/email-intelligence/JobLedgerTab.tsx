/**
 * JobLedgerTab — Funnemail job ledger viewer (Sprint 1).
 *
 * Mostra lo stato corrente di ogni email inbound nel pipeline Funnemail:
 * received → scouted → classified → routed → policy_applied → completed | failed | dlq.
 *
 * Read-only. Filtro per stage. Auto-refresh ogni 15s.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  listEmailProcessingJobs,
  type EmailProcessingJobRow,
  type EmailProcessingStage,
} from "@/data/emailProcessingJobs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, AlertCircle, CheckCircle2, Clock, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

const STAGES: Array<EmailProcessingStage | "all"> = [
  "all",
  "received",
  "scouted",
  "classified",
  "routed",
  "policy_applied",
  "completed",
  "failed",
  "dlq",
];

function stageColor(stage: EmailProcessingStage): string {
  switch (stage) {
    case "completed":
      return "bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30";
    case "failed":
    case "dlq":
      return "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30";
    case "received":
      return "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30";
    default:
      return "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30";
  }
}

function stageIcon(stage: EmailProcessingStage) {
  switch (stage) {
    case "completed": return <CheckCircle2 className="h-3.5 w-3.5" />;
    case "failed":
    case "dlq": return <XCircle className="h-3.5 w-3.5" />;
    default: return <Clock className="h-3.5 w-3.5" />;
  }
}

export default function JobLedgerTab() {
  const [stageFilter, setStageFilter] = useState<EmailProcessingStage | "all">("all");

  const { data: jobs, isLoading, error } = useQuery({
    queryKey: ["email-processing-jobs", stageFilter],
    queryFn: () => listEmailProcessingJobs({
      stage: stageFilter === "all" ? null : stageFilter,
      limit: 100,
    }),
    refetchInterval: 15_000,
  });

  return (
    <div className="flex flex-col gap-3 h-full overflow-hidden">
      <Card className="flex-shrink-0">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="text-base">Job Ledger Funnemail</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Ciclo di vita di ogni email inbound nel pipeline. Refresh ogni 15s.
              </p>
            </div>
            <Select value={stageFilter} onValueChange={(v) => setStageFilter(v as EmailProcessingStage | "all")}>
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue placeholder="Tutti gli stage" />
              </SelectTrigger>
              <SelectContent>
                {STAGES.map((s) => (
                  <SelectItem key={s} value={s} className="text-xs">{s === "all" ? "Tutti gli stage" : s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      <div className="flex-1 overflow-auto">
        {isLoading && (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Caricamento job…
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 p-4">
            <AlertCircle className="h-4 w-4" />
            {(error as Error).message}
          </div>
        )}
        {!isLoading && !error && (jobs?.length ?? 0) === 0 && (
          <div className="text-sm text-muted-foreground text-center py-12">
            Nessun job per questo filtro. La tabella si popola man mano che arrivano email inbound.
          </div>
        )}
        <div className="space-y-2 pr-1">
          {jobs?.map((j) => <JobRow key={j.id} job={j} />)}
        </div>
      </div>
    </div>
  );
}

function JobRow({ job }: { job: EmailProcessingJobRow }) {
  const startedAgo = formatDistanceToNow(new Date(job.started_at), { addSuffix: true, locale: it });
  const completedAgo = job.completed_at
    ? formatDistanceToNow(new Date(job.completed_at), { addSuffix: true, locale: it })
    : null;

  return (
    <div className="border border-border/60 rounded-md p-3 bg-card hover:bg-accent/30 transition-colors">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Badge variant="outline" className={`${stageColor(job.stage)} gap-1 text-xs`}>
            {stageIcon(job.stage)}
            {job.stage}
          </Badge>
          <code className="text-xs text-muted-foreground truncate">{job.message_id}</code>
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-3 flex-shrink-0">
          {job.attempts > 1 && <span>tentativi: {job.attempts}</span>}
          <span>iniziato {startedAgo}</span>
          {completedAgo && <span>· chiuso {completedAgo}</span>}
        </div>
      </div>
      {job.last_error && (
        <div className="mt-2 text-xs text-red-600 bg-red-500/5 border border-red-500/20 rounded px-2 py-1">
          {job.last_error}
        </div>
      )}
    </div>
  );
}