import { RefreshCw, Download, RotateCcw, Square, Loader2, Zap, ZapOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmailToolbarProps {
  onCheckNew: () => void;
  isCheckingNew: boolean;
  onStartSync: () => void;
  onStopSync: () => void;
  isSyncing: boolean;
  syncDownloaded: number;
  onReset: () => void;
  isResetting: boolean;
  autoSyncEnabled: boolean;
  onToggleAutoSync: () => void;
}

export function EmailToolbar({
  onCheckNew, isCheckingNew,
  onStartSync, onStopSync, isSyncing, syncDownloaded,
  onReset, isResetting,
  autoSyncEnabled, onToggleAutoSync,
}: EmailToolbarProps) {
  return (
    <div className="flex items-center gap-1">
      <Button
        size="sm"
        variant="outline"
        onClick={onCheckNew}
        disabled={isCheckingNew || isSyncing}
        className="h-6 gap-1 px-2 text-[10px]"
      >
        {isCheckingNew ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
        Nuove
      </Button>

      {isSyncing ? (
        <Button size="sm" variant="destructive" onClick={onStopSync} className="h-6 gap-1 px-2 text-[10px]">
          <Square className="h-3 w-3" /> Stop ({syncDownloaded})
        </Button>
      ) : (
        <Button size="sm" variant="default" onClick={onStartSync} disabled={isCheckingNew} className="h-6 gap-1 px-2 text-[10px]">
          <Download className="h-3 w-3" /> Scarica
        </Button>
      )}

      <Button
        size="sm"
        variant="ghost"
        onClick={onReset}
        disabled={isResetting || isSyncing}
        title="Reset sync"
        className="h-6 gap-1 px-1.5 text-[10px]"
      >
        {isResetting ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
      </Button>

      <button
        onClick={onToggleAutoSync}
        title={autoSyncEnabled ? "Auto-sync attivo (ogni 2 min)" : "Auto-sync disattivato"}
        className={cn(
          "h-6 w-6 flex items-center justify-center rounded-md transition-colors",
          autoSyncEnabled
            ? "bg-primary/15 text-primary"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
        )}
      >
        {autoSyncEnabled ? <Zap className="h-3 w-3" /> : <ZapOff className="h-3 w-3" />}
      </button>
    </div>
  );
}
