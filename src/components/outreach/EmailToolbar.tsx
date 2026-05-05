import { Download, RotateCcw, Square, Loader2, Zap, ZapOff, PenSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAppNavigate } from "@/hooks/useAppNavigate";

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
  const navigate = useAppNavigate();
  // Un solo bottone unificato "Scarica nuove": esegue checkNew (rapido) o stop se sync continua è attiva.
  const downloading = isCheckingNew || isSyncing;
  return (
    <div className="flex items-center gap-3">
      {/* Sezione: SINCRONIZZAZIONE — un solo bottone "Scarica nuove" con stato/contatore inline */}
      <div className="flex flex-col gap-0.5">
        <span className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground/70 px-1">Sincronizzazione</span>
        <div className="flex items-center gap-1">
          {isSyncing ? (
            <Button
              size="sm"
              variant="destructive"
              onClick={onStopSync}
              className="h-7 gap-1.5 px-2 text-[11px]"
              title="Interrompi sincronizzazione in corso"
            >
              <Square className="h-3 w-3" /> Stop · {syncDownloaded}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="default"
              onClick={onCheckNew}
              disabled={downloading}
              className="h-7 gap-1.5 px-2 text-[11px]"
              title="Scarica nuove email dal server"
            >
              {isCheckingNew ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
              Scarica nuove
            </Button>
          )}
          {!isSyncing && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onStartSync}
              disabled={downloading}
              className="h-7 gap-1.5 px-2 text-[11px] text-muted-foreground hover:text-foreground"
              title="Avvia download massivo continuo"
            >
              <Download className="h-3 w-3" /> Download massivo
            </Button>
          )}
          <button
            onClick={onToggleAutoSync}
            title={autoSyncEnabled ? "Auto-sync attivo (ogni 2 min) — clicca per disattivare" : "Auto-sync disattivato — clicca per attivare"}
            className={cn(
              "h-7 px-2 flex items-center gap-1 rounded-md text-[10px] font-medium transition-colors border",
              autoSyncEnabled
                ? "bg-primary/15 text-primary border-primary/30"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40 border-transparent"
            )}
          >
            {autoSyncEnabled ? <Zap className="h-3 w-3" /> : <ZapOff className="h-3 w-3" />}
            Auto
          </button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onReset}
            disabled={isResetting || isSyncing}
            title="Reset cursore di sincronizzazione"
            className="h-7 gap-1 px-1.5 text-[10px] text-muted-foreground"
          >
            {isResetting ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      {/* Divider */}
      <div className="h-8 w-px bg-border" />

      {/* Sezione: AZIONI */}
      <div className="flex flex-col gap-0.5">
        <span className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground/70 px-1">Azioni</span>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="default"
            onClick={() => navigate("/v2/email-composer")}
            className="h-7 gap-1.5 px-2 text-[11px]"
            title="Componi nuova email"
          >
            <PenSquare className="h-3 w-3" /> Nuova email
          </Button>
        </div>
      </div>
    </div>
  );
}
