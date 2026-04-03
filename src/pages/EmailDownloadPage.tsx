import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Clock, Download, Mail, RotateCcw, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DownloadedEmailList } from "@/components/outreach/download/DownloadedEmailList";
import { DownloadedEmailPreview } from "@/components/outreach/download/DownloadedEmailPreview";
import { useResetSync } from "@/hooks/useEmailSync";
import { useEmailCount } from "@/hooks/useEmailCount";
import {
  bgSyncGetEmailHistory,
  bgSyncIsRunning,
  bgSyncStart,
  bgSyncStop,
  bgSyncSubscribe,
  bgSyncSubscribeEmails,
  type BgSyncProgress,
  type DownloadedEmail,
} from "@/lib/backgroundSync";

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
}

export default function EmailDownloadPage() {
  const [progress, setProgress] = useState<BgSyncProgress>(() => ({
    downloaded: 0,
    skipped: 0,
    remaining: 0,
    batch: 0,
    lastSubject: "",
    status: "idle",
    elapsedSeconds: 0,
  }));
  const [emails, setEmails] = useState<DownloadedEmail[]>(() => bgSyncGetEmailHistory());
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(() => bgSyncGetEmailHistory()[0]?.id ?? null);
  const [isSyncing, setIsSyncing] = useState(bgSyncIsRunning);
  const resetSync = useResetSync();
  const { data: emailCount = 0 } = useEmailCount(isSyncing);

  useEffect(() => {
    const unsubProgress = bgSyncSubscribe((nextProgress) => {
      setProgress(nextProgress);
      setIsSyncing(nextProgress.status === "syncing");
    });

    const unsubEmails = bgSyncSubscribeEmails((email) => {
      setEmails((prev) => [email, ...prev.filter((item) => item.id !== email.id)]);
      setSelectedEmailId((prev) => prev ?? email.id);
    });

    return () => {
      unsubProgress();
      unsubEmails();
    };
  }, []);

  useEffect(() => {
    if (emails.length === 0) {
      setSelectedEmailId(null);
      return;
    }

    setSelectedEmailId((prev) => (prev && emails.some((email) => email.id === prev) ? prev : emails[0].id));
  }, [emails]);

  const handleStart = useCallback(() => {
    setEmails([]);
    setSelectedEmailId(null);
    bgSyncStart();
  }, []);

  const selectedEmail = useMemo(
    () => emails.find((email) => email.id === selectedEmailId) ?? null,
    [emails, selectedEmailId],
  );

  const isRunning = progress.status === "syncing";
  const isDone = progress.status === "done";
  const isError = progress.status === "error";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex flex-shrink-0 flex-wrap items-start justify-between gap-3 border-b border-border p-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Mail className="h-5 w-5 text-primary" />
            Download Email
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{emailCount.toLocaleString()} email in database</p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {isRunning && (
            <div className="mr-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {formatElapsed(progress.elapsedSeconds)}
              <span className="ml-2 font-bold text-primary">{progress.downloaded}</span>
              <span>scaricate</span>
              {progress.skipped > 0 && <span className="ml-1 text-muted-foreground/70">{progress.skipped} saltate</span>}
              {progress.remaining > 0 && <span className="ml-1 text-muted-foreground/70">({progress.remaining} rimanenti)</span>}
            </div>
          )}

          {isDone && (
            <div className="mr-2 flex items-center gap-1.5 text-xs text-primary">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Completato — {progress.downloaded} email{progress.skipped > 0 ? `, ${progress.skipped} saltate` : ""} in {formatElapsed(progress.elapsedSeconds)}
            </div>
          )}

          {isError && (
            <div className="mr-2 flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />
              {progress.errorMessage}
            </div>
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={() => resetSync.mutate()}
            disabled={resetSync.isPending || isSyncing}
            className="gap-1.5"
          >
            {resetSync.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
            Reset
          </Button>

          {isSyncing ? (
            <Button size="sm" variant="destructive" onClick={bgSyncStop} className="gap-1.5">
              <Square className="h-3.5 w-3.5" /> Stop
            </Button>
          ) : (
            <Button size="sm" onClick={handleStart} className="gap-1.5">
              <Download className="h-3.5 w-3.5" /> Scarica Tutto
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <DownloadedEmailList
          emails={emails}
          selectedEmailId={selectedEmailId}
          onSelect={setSelectedEmailId}
          isRunning={isRunning}
          emailCount={emailCount}
        />

        <div className="flex-1 min-w-0 overflow-hidden bg-muted/20">
          {selectedEmail ? (
            <DownloadedEmailPreview email={selectedEmail} />
          ) : (
            <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
              <div>
                <Mail className="mx-auto mb-2 h-12 w-12 opacity-20" />
                <p>Seleziona una email per visualizzarla</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
