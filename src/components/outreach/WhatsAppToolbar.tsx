import { RefreshCw, Loader2, Wifi, WifiOff, Play, Pause, Download, Square, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type WhatsAppToolbarProps = {
  enabled: boolean;
  toggle: () => void;
  isReading: boolean;
  isAvailable: boolean;
  isAuthenticated: boolean;
  manualCycle: () => void;
  isPausedForNight?: boolean;
  nextCycleAt?: Date | null;
  bfProgress: {
    status: string;
    phase: string;
    currentChat: string | null;
    chatsProcessed: number;
    chatsTotal: number;
    recoveredMessages: number;
    lastError: string | null;
  };
  startBackfill: () => void;
  stopBackfill: () => void;
};

function formatCountdown(target: Date | null | undefined): string {
  if (!target) return "";
  const ms = target.getTime() - Date.now();
  if (ms <= 0) return "ora";
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const remSec = sec % 60;
  return `${min}m ${remSec}s`;
}

export function WhatsAppToolbar({
  enabled, toggle, isReading, isAvailable, isAuthenticated, manualCycle,
  isPausedForNight, nextCycleAt,
  bfProgress, startBackfill, stopBackfill,
}: WhatsAppToolbarProps) {
  const badgeState = !isAvailable
    ? { variant: "destructive" as const, label: "Ext Off", color: "" }
    : !isAuthenticated
      ? { variant: "outline" as const, label: "Sessione", color: "border-yellow-500 text-yellow-600 bg-yellow-500/10" }
      : { variant: "default" as const, label: "On", color: "" };

  const canAct = isAvailable && isAuthenticated;
  const isBfActive = bfProgress.status === "running" || bfProgress.status === "paused";

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1">
        <Button size="sm" variant="outline" onClick={() => manualCycle()} disabled={isReading || !canAct} className="gap-1 h-6 text-[10px] px-1.5">
          {isReading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Leggi
        </Button>
        <Button size="sm" variant={enabled ? "default" : "outline"} onClick={toggle} disabled={!canAct} className="gap-1 h-6 text-[10px] px-1.5">
          {enabled ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          {enabled ? "ON" : "OFF"}
        </Button>
        {isBfActive ? (
          <Button size="sm" variant="destructive" onClick={stopBackfill} className="gap-1 h-6 text-[10px] px-1.5">
            <Square className="w-3 h-3" /> Stop
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={startBackfill} disabled={!canAct} className="gap-1 h-6 text-[10px] px-1.5" title="Recupera messaggi persi">
            <Download className="w-3 h-3" /> Backfill
          </Button>
        )}
        <Badge variant={badgeState.variant} className={cn("text-[9px] gap-0.5 h-5 px-1.5 cursor-default", badgeState.color)}>
          {isAvailable ? (isAuthenticated ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />) : <WifiOff className="w-2.5 h-2.5" />}
          {badgeState.label}
        </Badge>
        {isPausedForNight && (
          <Badge variant="outline" className="text-[9px] gap-0.5 h-5 px-1.5 cursor-default border-blue-500/50 text-blue-600 bg-blue-500/10">
            <Moon className="w-2.5 h-2.5" /> Notte
          </Badge>
        )}
        {enabled && nextCycleAt && !isPausedForNight && (
          <span className="text-[9px] text-muted-foreground">~{formatCountdown(nextCycleAt)}</span>
        )}
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
              </>
            )}
          </span>
        </div>
      )}
      {bfProgress.status === "done" && bfProgress.recoveredMessages > 0 && (
        <span className="text-[9px] text-green-600 mt-0.5">✓ {bfProgress.recoveredMessages} recuperati da {bfProgress.chatsTotal} chat</span>
      )}
    </div>
  );
}
