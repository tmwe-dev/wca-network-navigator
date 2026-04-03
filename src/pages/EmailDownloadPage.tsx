/**
 * Dedicated email download page — Matrix-style live feed with email preview slides.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { Download, Square, RotateCcw, Loader2, CheckCircle2, AlertCircle, Clock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useResetSync } from "@/hooks/useEmailSync";
import { useEmailCount } from "@/hooks/useEmailCount";
import {
  bgSyncSubscribe, bgSyncSubscribeEmails, bgSyncStart, bgSyncStop,
  bgSyncIsRunning, bgSyncGetEmailHistory,
  type BgSyncProgress, type DownloadedEmail,
} from "@/lib/backgroundSync";

function formatElapsed(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

export default function EmailDownloadPage() {
  const [progress, setProgress] = useState<BgSyncProgress>(() => ({
    downloaded: 0, batch: 0, lastSubject: "", status: "idle", elapsedSeconds: 0,
  }));
  const [emails, setEmails] = useState<DownloadedEmail[]>(() => bgSyncGetEmailHistory());
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(bgSyncIsRunning);
  const listEndRef = useRef<HTMLDivElement>(null);
  const resetSync = useResetSync();
  const { data: emailCount = 0 } = useEmailCount(isSyncing);

  useEffect(() => {
    const unsub1 = bgSyncSubscribe((p) => {
      setProgress(p);
      setIsSyncing(p.status === "syncing");
    });
    const unsub2 = bgSyncSubscribeEmails((e) => {
      setEmails(prev => [...prev, e]);
    });
    return () => { unsub1(); unsub2(); };
  }, []);

  // Auto-scroll list & auto-select latest
  useEffect(() => {
    if (emails.length > 0) {
      setSelectedIdx(emails.length - 1);
      listEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [emails.length]);

  const handleStart = useCallback(() => {
    setEmails([]);
    setSelectedIdx(null);
    bgSyncStart();
  }, []);

  const selectedEmail = selectedIdx !== null ? emails[selectedIdx] : null;
  const isRunning = progress.status === "syncing";
  const isDone = progress.status === "done";
  const isError = progress.status === "error";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              Download Email
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {emailCount.toLocaleString()} email in database
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isRunning && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-2">
                <Clock className="w-3.5 h-3.5" />
                {formatElapsed(progress.elapsedSeconds)}
                <span className="text-primary font-bold ml-2">{progress.downloaded}</span>
                <span>scaricate</span>
              </div>
            )}
            {isDone && (
              <div className="flex items-center gap-1.5 text-xs text-primary mr-2">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Completato — {progress.downloaded} email in {formatElapsed(progress.elapsedSeconds)}
              </div>
            )}
            {isError && (
              <div className="flex items-center gap-1.5 text-xs text-destructive mr-2">
                <AlertCircle className="w-3.5 h-3.5" />
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
              {resetSync.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
              Reset
            </Button>

            {isSyncing ? (
              <Button size="sm" variant="destructive" onClick={bgSyncStop} className="gap-1.5">
                <Square className="w-3.5 h-3.5" /> Stop
              </Button>
            ) : (
              <Button size="sm" onClick={handleStart} className="gap-1.5">
                <Download className="w-3.5 h-3.5" /> Scarica Tutto
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main canvas: left list + right preview */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Matrix-style email list */}
        <div className="w-[380px] flex-shrink-0 border-r border-border bg-[hsl(var(--background))] flex flex-col">
          {emails.length === 0 && !isRunning ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center space-y-2">
                <Download className="w-10 h-10 mx-auto opacity-30" />
                <p className="text-sm">Premi "Scarica Tutto" per iniziare</p>
              </div>
            </div>
          ) : (
            <ScrollArea className="flex-1">
              <div className="p-1">
                {emails.map((email, idx) => (
                  <div
                    key={email.id}
                    onClick={() => setSelectedIdx(idx)}
                    className={cn(
                      "flex items-start gap-2 px-3 py-2 rounded cursor-pointer transition-all duration-150 group",
                      "hover:bg-accent/50",
                      selectedIdx === idx
                        ? "bg-primary/10 border-l-2 border-primary"
                        : "border-l-2 border-transparent",
                      // Matrix fade-in effect
                      "animate-fade-in"
                    )}
                  >
                    <span className="text-[10px] text-muted-foreground/50 font-mono mt-1 w-5 text-right flex-shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-foreground truncate leading-tight">
                        {email.subject}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                        {email.from}
                      </div>
                      <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                        {formatTime(email.date)}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={listEndRef} />
                {isRunning && (
                  <div className="flex items-center gap-2 px-3 py-2 text-xs text-primary animate-pulse">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Scaricamento in corso...
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          {/* Bottom counter */}
          <div className="flex-shrink-0 border-t border-border px-3 py-2 text-[11px] text-muted-foreground flex items-center justify-between bg-muted/30">
            <span>{emails.length} scaricate in questa sessione</span>
            <span className="font-mono">{emailCount.toLocaleString()} totali</span>
          </div>
        </div>

        {/* Right: Email preview slide */}
        <div className="flex-1 min-w-0 bg-muted/20 flex items-center justify-center p-4 overflow-hidden">
          {selectedEmail ? (
            <EmailSlide email={selectedEmail} key={selectedEmail.id} />
          ) : (
            <div className="text-muted-foreground text-sm text-center">
              <Mail className="w-12 h-12 mx-auto opacity-20 mb-2" />
              <p>Seleziona una email per visualizzarla</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Email preview rendered as a slide/card */
function EmailSlide({ email }: { email: DownloadedEmail }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!iframeRef.current) return;
    const doc = iframeRef.current.contentDocument;
    if (!doc) return;

    const html = email.bodyHtml || `<pre style="font-family:sans-serif;white-space:pre-wrap;padding:20px;color:#333;">${escapeHtml(email.bodyText || "(nessun contenuto)")}</pre>`;

    doc.open();
    doc.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  body { margin: 0; padding: 16px; font-family: -apple-system, sans-serif; font-size: 13px; color: #222; background: #fff; overflow: auto; }
  img { max-width: 100%; height: auto; }
  table { max-width: 100% !important; }
  * { max-width: 100% !important; box-sizing: border-box; }
</style></head><body>${html}</body></html>`);
    doc.close();
  }, [email]);

  return (
    <div className="w-full max-w-3xl animate-scale-in">
      {/* Slide header */}
      <div className="bg-card border border-border rounded-t-lg px-4 py-3 flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground truncate">{email.subject}</div>
          <div className="text-xs text-muted-foreground truncate mt-0.5">
            Da: {email.from} — {formatTime(email.date)}
          </div>
        </div>
      </div>
      {/* Slide body — iframe */}
      <div className="border border-t-0 border-border rounded-b-lg overflow-hidden bg-white" style={{ height: "calc(100vh - 260px)", minHeight: 300 }}>
        <iframe
          ref={iframeRef}
          title="Email preview"
          sandbox="allow-same-origin"
          className="w-full h-full border-0"
        />
      </div>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
