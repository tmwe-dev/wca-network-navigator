import { RefreshCw, Loader2, Wifi, WifiOff, Download, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { OptimusBadge } from "@/components/outreach/OptimusBadge";
import { useLinkedInSync } from "@/hooks/useLinkedInSync";
import { useLinkedInMessagingBridge } from "@/hooks/useLinkedInMessagingBridge";
import { useLinkedInBackfill } from "@/hooks/useLinkedInBackfill";
import { SyncGuardIndicator } from "@/v2/ui/atoms/SyncGuardIndicator";

/**
 * LinkedInToolbar — parità visiva con WhatsAppToolbar/EmailToolbar.
 * Mostra "Leggi", badge stato LI/FS, OptimusBadge, controllo Backfill.
 */
export function LinkedInToolbar() {
  const { isReading, readNow } = useLinkedInSync();
  const { isAvailable, isFireScrapeAvailable } = useLinkedInMessagingBridge();
  const { progress, startBackfill, stopBackfill } = useLinkedInBackfill();

  const liBadge = isAvailable
    ? { variant: "default" as const, color: "" }
    : { variant: "destructive" as const, color: "" };
  const fsBadge = isFireScrapeAvailable
    ? { variant: "default" as const, color: "" }
    : { variant: "secondary" as const, color: "" };

  const isBackfilling = progress.status === "running" || progress.status === "paused";

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1">
        <SyncGuardIndicator channel="linkedin" />
        <Button
          size="sm"
          variant="outline"
          onClick={() => readNow()}
          disabled={isReading || !isAvailable}
          title={isAvailable ? "Leggi inbox LinkedIn" : "Estensione LinkedIn non rilevata"}
          className="gap-1 h-6 text-[10px] px-1.5"
        >
          {isReading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Leggi
        </Button>
        <Badge variant={liBadge.variant} className={cn("text-[9px] gap-0.5 h-5 px-1.5 cursor-default", liBadge.color)} title="Estensione LinkedIn">
          {isAvailable ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />}
          LI
        </Badge>
        <Badge variant={fsBadge.variant} className={cn("text-[9px] gap-0.5 h-5 px-1.5 cursor-default", fsBadge.color)} title="FireScrape extension">
          {isFireScrapeAvailable ? "🔥" : "⭕"} FS
        </Badge>
        {isBackfilling ? (
          <Button
            size="sm"
            variant="destructive"
            onClick={stopBackfill}
            className="gap-1 h-6 text-[10px] px-1.5"
            title="Interrompi backfill"
          >
            <Square className="w-3 h-3" /> Stop
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={startBackfill}
            disabled={!isAvailable}
            className="gap-1 h-6 text-[10px] px-1.5 text-muted-foreground hover:text-foreground"
            title="Recupera messaggi vecchi"
          >
            <Download className="w-3 h-3" /> Backfill
          </Button>
        )}
        <OptimusBadge channel="linkedin" pageType="messaging" />
      </div>
      {isBackfilling && (
        <div className="text-[9px] text-muted-foreground mt-1 truncate max-w-[260px]">
          {progress.phase === "discovery" ? "Discovery…" : `${progress.threadsProcessed}/${progress.threadsTotal} thread`}
          {progress.recoveredMessages > 0 && ` · ${progress.recoveredMessages} msg`}
        </div>
      )}
    </div>
  );
}