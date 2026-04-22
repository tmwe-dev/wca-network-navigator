/**
 * EmailDownloadPage V2
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle, CheckCircle2, Download, Mail, Pause, Play,
  RotateCcw, Square, Loader2, Server,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { DownloadedEmailList } from "@/components/outreach/download/DownloadedEmailList";
import { DownloadedEmailPreview } from "@/components/outreach/download/DownloadedEmailPreview";
import { useResetSync } from "@/hooks/useEmailSync";
import { useEmailCount } from "@/hooks/useEmailCount";
import { useServerSyncJob } from "@/hooks/useServerSyncJob";
import { useDownloadedEmailsFeed } from "@/hooks/useDownloadedEmailsFeed";
import { cn } from "@/lib/utils";

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function timeSince(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s fa`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m fa`;
  return `${Math.floor(diff / 3600)}h fa`;
}

export function EmailDownloadPage() {
  // Server-side job
  const { activeJob, lastCompletedJob, startJob, pauseJob, resumeJob, cancelJob } = useServerSyncJob();
  const { emails, isLoading: isEmailsLoading } = useDownloadedEmailsFeed();

  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);

  const resetSync = useResetSync();
  const { data: emailCount = 0 } = useEmailCount(
    startJob.isPending || resumeJob.isPending || activeJob?.status === "running",
  );

  useEffect(() => {
    if (emails.length === 0) {
      if (selectedEmailId !== null) setSelectedEmailId(null);
      return;
    }

    const selectionStillExists = selectedEmailId
      ? emails.some((email) => email.id === selectedEmailId)
      : false;

    if (!selectionStillExists) {
      setSelectedEmailId(emails[0].id);
    }
  }, [emails, selectedEmailId]);

  const selectedEmail = useMemo(
    () => emails.find((e) => e.id === selectedEmailId) ?? null,
    [emails, selectedEmailId],
  );

  // Start server job
  const handleStartServer = useCallback(() => {
    startJob.mutate();
  }, [startJob]);

  const handlePause = useCallback(() => {
    pauseJob.mutate();
  }, [pauseJob]);

  const handleResume = useCallback(() => {
    resumeJob.mutate();
  }, [resumeJob]);

  const handleStop = useCallback(() => {
    cancelJob.mutate();
  }, [cancelJob]);

  const isServerRunning = activeJob?.status === "running";
  const isServerPaused = activeJob?.status === "paused";
  const isServerError = activeJob?.status === "error";
  const hasActiveJob = !!activeJob;
  const isSyncing = isServerRunning || startJob.isPending || resumeJob.isPending;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex flex-shrink-0 flex-wrap items-start justify-between gap-3 border-b border-border p-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Mail className="h-5 w-5 text-primary" />
            Download Email
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {emailCount.toLocaleString()} email in database
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => resetSync.mutate()} disabled={resetSync.isPending || isServerRunning} className="gap-1.5">
            {resetSync.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
            Reset
          </Button>

          {isServerRunning ? (
            <>
              <Button size="sm" variant="outline" onClick={handlePause} className="gap-1.5">
                <Pause className="h-3.5 w-3.5" /> Pausa
              </Button>
              <Button size="sm" variant="destructive" onClick={handleStop} className="gap-1.5">
                <Square className="h-3.5 w-3.5" /> Stop
              </Button>
            </>
          ) : isServerPaused ? (
            <>
              <Button size="sm" onClick={handleResume} className="gap-1.5">
                <Play className="h-3.5 w-3.5" /> Riprendi
              </Button>
              <Button size="sm" variant="destructive" onClick={handleStop} className="gap-1.5">
                <Square className="h-3.5 w-3.5" /> Stop
              </Button>
            </>
          ) : isServerError ? (
            <>
              <Button size="sm" onClick={handleResume} className="gap-1.5">
                <Play className="h-3.5 w-3.5" /> Riprova
              </Button>
              <Button size="sm" variant="destructive" onClick={handleStop} className="gap-1.5">
                <Square className="h-3.5 w-3.5" /> Annulla
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={handleStartServer} disabled={startJob.isPending} className="gap-1.5">
              {startJob.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Scarica Tutto
            </Button>
          )}
        </div>
      </div>

      {/* Server job status banner */}
      {hasActiveJob && (
        <div className={cn(
          "flex-shrink-0 border-b border-border px-4 py-3 space-y-2",
          isServerRunning && "bg-primary/5",
          isServerPaused && "bg-amber-500/5",
          isServerError && "bg-destructive/5",
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Server className="h-4 w-4 text-muted-foreground" />
              {isServerRunning && (
                <><Loader2 className="h-4 w-4 animate-spin text-primary" /><span className="text-primary">Download autonomo in corso...</span></>
              )}
              {isServerPaused && (
                <><Pause className="h-4 w-4 text-amber-500" /><span className="text-amber-600">Download in pausa</span></>
              )}
              {isServerError && (
                <><AlertCircle className="h-4 w-4 text-destructive" /><span className="text-destructive">Errore nel download</span></>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {activeJob.last_batch_at && (
                <span>Ultimo batch: {timeSince(activeJob.last_batch_at)}</span>
              )}
              <span className="flex items-center gap-1">
                <Server className="h-3 w-3" />
                Continua anche a browser chiuso
              </span>
            </div>
          </div>

          {isServerRunning && <Progress value={undefined} className="h-1.5 [&>div]:animate-pulse" />}

          <div className="grid grid-cols-4 gap-2 text-xs">
            <div className="flex flex-col items-center rounded bg-background/80 p-1.5">
              <span className="text-lg font-bold text-foreground">{activeJob.downloaded_count}</span>
              <span className="text-muted-foreground">scaricate</span>
            </div>
            <div className="flex flex-col items-center rounded bg-background/80 p-1.5">
              <span className="text-lg font-bold text-foreground">{activeJob.skipped_count}</span>
              <span className="text-muted-foreground">saltate</span>
            </div>
            <div className="flex flex-col items-center rounded bg-background/80 p-1.5">
              <span className="text-lg font-bold text-muted-foreground">{activeJob.total_remaining}</span>
              <span className="text-muted-foreground">rimanenti</span>
            </div>
            <div className="flex flex-col items-center rounded bg-background/80 p-1.5">
              <span className="text-lg font-bold text-primary">{emailCount.toLocaleString()}</span>
              <span className="text-muted-foreground">in database</span>
            </div>
          </div>

          {isServerError && activeJob.error_message && (
            <div className="rounded bg-destructive/10 px-2 py-1 text-xs text-destructive">
              ⚠️ {activeJob.error_message}
            </div>
          )}
        </div>
      )}

      {/* Last completed job summary */}
      {!hasActiveJob && lastCompletedJob && (
        <div className="flex-shrink-0 border-b border-border bg-accent/30 px-4 py-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
            Ultimo download completato: {lastCompletedJob.downloaded_count} email scaricate, {lastCompletedJob.skipped_count} saltate
            {lastCompletedJob.completed_at && ` — ${timeSince(lastCompletedJob.completed_at)}`}
          </div>
        </div>
      )}

      {/* Main area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <DownloadedEmailList
          emails={emails}
          selectedEmailId={selectedEmailId}
          onSelect={setSelectedEmailId}
          isRunning={isSyncing}
          isLoading={isEmailsLoading}
          emailCount={emailCount}
        />
        <div className="flex-1 min-w-0 overflow-hidden bg-muted/20">
          {selectedEmail ? (
            <DownloadedEmailPreview email={selectedEmail} />
          ) : isEmailsLoading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
              <div>
                <Mail className="mx-auto mb-2 h-12 w-12 opacity-20" />
                {hasActiveJob ? (
                  <p>Il download procede in background anche a browser chiuso.<br />Le email appariranno nella lista quando apri questa pagina.</p>
                ) : (
                  <p>Premi "Scarica Tutto" per avviare il download.<br />Continuerà anche a computer spento.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
