import { RefreshCw, Loader2, Wifi, WifiOff, Download, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useBackfillState } from "@/hooks/useBackfillState";

export type WhatsAppToolbarProps = {
  isReading: boolean;
  isAvailable: boolean;
  isAuthenticated: boolean;
  readNow: () => void;
  bfProgress: {
    status: string;
    phase: string;
    currentChat: string | null;
    chatsProcessed: number;
    chatsTotal: number;
    chatsCompleted?: number;
    recoveredMessages: number;
    duplicatesSkipped?: number;
    lastError: string | null;
  };
  startBackfill: () => void;
  stopBackfill: () => void;
};

export function WhatsAppToolbar({
  isReading, isAvailable, isAuthenticated, readNow,
  bfProgress, startBackfill, stopBackfill,
}: WhatsAppToolbarProps) {
  const { data: bfState } = useBackfillState("whatsapp");

  const badgeState = !isAvailable
    ? { variant: "destructive" as const, label: "Ext Off", color: "" }
    : !isAuthenticated
      ? { variant: "outline" as const, label: "Sessione", color: "border-yellow-500 text-yellow-600 bg-yellow-500/10" }
      : { variant: "default" as const, label: "On", color: "" };

  const isBfActive = bfProgress.status === "running" || bfProgress.status === "paused";

  const oldestDate = bfState?.oldestMessageAt
    ? new Date(bfState.oldestMessageAt).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })
    : null;

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1">
        <Button size="sm" variant="outline" onClick={() => readNow()} disabled={isReading} className="gap-1 h-6 text-[10px] px-1.5">
          {isReading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Leggi
        </Button>
        {isBfActive ? (
          <Button size="sm" variant="destructive" onClick={stopBackfill} className="gap-1 h-6 text-[10px] px-1.5">
            <Square className="w-3 h-3" /> Stop
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={startBackfill} className="gap-1 h-6 text-[10px] px-1.5" title="Recupera messaggi persi">
            <Download className="w-3 h-3" /> Backfill
          </Button>
        )}
        <Badge variant={badgeState.variant} className={cn("text-[9px] gap-0.5 h-5 px-1.5 cursor-default", badgeState.color)}>
          {isAvailable ? (isAuthenticated ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />) : <WifiOff className="w-2.5 h-2.5" />}
          {badgeState.label}
        </Badge>
      </div>
      {isBfActive && (
        <div className="flex items-center gap-2 mt-1">
          <Progress value={bfProgress.chatsTotal > 0 ? (bfProgress.chatsProcessed / bfProgress.chatsTotal) * 100 : 0} className="h-1 flex-1 max-w-[120px]" />
          <span className="text-[9px] text-muted-foreground whitespace-nowrap truncate max-w-[200px]">
            {bfProgress.phase === "discovery" ? "🔍 Analisi chat..." : (
              <>
                {bfProgress.status === "paused" ? "⏸ " : "▶ "}
                {bfProgress.currentChat ? `${bfProgress.currentChat} ` : ""}
                {bfProgress.chatsProcessed}/{bfProgress.chatsTotal} • {bfProgress.recoveredMessages} nuovi
                {bfProgress.duplicatesSkipped ? ` • ${bfProgress.duplicatesSkipped} dup` : ""}
              </>
            )}
          </span>
        </div>
      )}
      {bfProgress.status === "done" && bfProgress.recoveredMessages > 0 && (
        <span className="text-[9px] text-green-600 mt-0.5">✓ {bfProgress.recoveredMessages} recuperati da {bfProgress.chatsTotal} chat</span>
      )}
      {!isBfActive && bfState && bfState.totalChats > 0 && (
        <span className="text-[9px] text-muted-foreground mt-0.5">
          Backfill: {bfState.completedChats}/{bfState.totalChats} chat complete
          {oldestDate && ` • dal ${oldestDate}`}
        </span>
      )}
    </div>
  );
}
