import { RefreshCw, Loader2, Wifi, WifiOff, Play, Pause, Zap, Eye, Radio, Download, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useWhatsAppAdaptiveSync } from "@/hooks/useWhatsAppAdaptiveSync";
import { useWhatsAppBackfill } from "@/hooks/useWhatsAppBackfill";

const LEVEL_CONFIG = {
  0: { label: "Idle", color: "bg-muted text-muted-foreground", icon: Eye },
  3: { label: "Alert", color: "bg-yellow-500/20 text-yellow-700", icon: Zap },
  6: { label: "Live", color: "bg-green-500/20 text-green-700", icon: Radio },
} as const;

export function WhatsAppToolbar() {
  const { level, enabled, toggle, isReading, isAvailable, readNow } = useWhatsAppAdaptiveSync();
  const { progress: bfProgress, startBackfill, stopBackfill } = useWhatsAppBackfill();

  const levelCfg = LEVEL_CONFIG[level];
  const LevelIcon = levelCfg.icon;

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1">
        <Button size="sm" variant="outline" onClick={() => readNow()} disabled={isReading || !isAvailable} className="gap-1 h-6 text-[10px] px-1.5">
          {isReading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Leggi
        </Button>
        <Button size="sm" variant={enabled ? "default" : "outline"} onClick={toggle} disabled={!isAvailable} className="gap-1 h-6 text-[10px] px-1.5">
          {enabled ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          {enabled ? "ON" : "OFF"}
        </Button>
        {bfProgress.status === "running" || bfProgress.status === "paused" ? (
          <Button size="sm" variant="destructive" onClick={stopBackfill} className="gap-1 h-6 text-[10px] px-1.5">
            <Square className="w-3 h-3" /> Stop
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={startBackfill} disabled={!isAvailable} className="gap-1 h-6 text-[10px] px-1.5" title="Recupera messaggi">
            <Download className="w-3 h-3" /> Backfill
          </Button>
        )}
        <Badge variant={isAvailable ? "default" : "destructive"} className="text-[9px] gap-0.5 h-5 px-1.5">
          {isAvailable ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />}
          {isAvailable ? "On" : "Off"}
        </Badge>
        {enabled && (
          <Badge className={cn("text-[9px] gap-0.5 h-5 px-1.5 border-0", levelCfg.color)}>
            <LevelIcon className="w-2.5 h-2.5" />
            L{level}
          </Badge>
        )}
      </div>
      {/* Backfill progress bar */}
      {(bfProgress.status === "running" || bfProgress.status === "paused") && (
        <div className="flex items-center gap-2 mt-1">
          <Progress value={bfProgress.totalCycles > 0 ? (bfProgress.cycle / bfProgress.totalCycles) * 100 : 0} className="h-1 flex-1 max-w-[120px]" />
          <span className="text-[9px] text-muted-foreground whitespace-nowrap">
            {bfProgress.cycle}/{bfProgress.totalCycles} • {bfProgress.recoveredMessages} nuovi
          </span>
        </div>
      )}
      {bfProgress.status === "done" && bfProgress.recoveredMessages > 0 && (
        <span className="text-[9px] text-green-600 mt-0.5">✓ {bfProgress.recoveredMessages} recuperati</span>
      )}
    </div>
  );
}
