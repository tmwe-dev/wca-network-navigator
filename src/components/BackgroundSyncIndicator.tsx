/**
 * Global floating indicator for background email sync.
 * Shows a small pill when sync is running and user is NOT on outreach page.
 */
import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Loader2, CheckCircle2, AlertCircle, X } from "lucide-react";
import { bgSyncSubscribe, bgSyncStop, type BgSyncProgress } from "@/lib/backgroundSync";

export function BackgroundSyncIndicator() {
  const [progress, setProgress] = useState<BgSyncProgress | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const location = useLocation();

  useEffect(() => {
    return bgSyncSubscribe((p) => {
      setProgress(p);
      if (p.status === "syncing") setDismissed(false);
    });
  }, []);

  // Don't show on outreach page (it has its own panel) or if idle/dismissed
  const isOnOutreach = location.pathname.startsWith("/outreach") || location.pathname.startsWith("/v2/outreach");
  if (!progress || progress.status === "idle" || isOnOutreach || dismissed) return null;

  const isDone = progress.status === "done";
  const isError = progress.status === "error";
  const isRunning = progress.status === "syncing";

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 bg-card border border-border rounded-lg shadow-lg px-3 py-2 text-sm animate-in slide-in-from-bottom-2">
      {isRunning && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
      {isDone && <CheckCircle2 className="w-4 h-4 text-primary" />}
      {isError && <AlertCircle className="w-4 h-4 text-destructive" />}
      
      <span className="text-foreground">
        {isRunning && `📬 Download email: ${progress.downloaded} scaricate...`}
        {isDone && `✅ ${progress.downloaded} email scaricate`}
        {isError && `❌ Errore sync`}
      </span>

      {isRunning && (
        <button
          onClick={bgSyncStop}
          className="text-muted-foreground hover:text-destructive ml-1"
          title="Ferma download"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
      {(isDone || isError) && (
        <button
          onClick={() => setDismissed(true)}
          className="text-muted-foreground hover:text-foreground ml-1"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
