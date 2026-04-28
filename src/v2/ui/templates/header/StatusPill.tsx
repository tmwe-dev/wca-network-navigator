/**
 * StatusPill — Aggregatore compatto di stato sistema in top bar.
 * Sostituisce ConnectionStatusBar + ActiveProcessIndicator + badge Offline.
 * Default: pallino colorato. Click → popover con dettagli e shortcut ai pannelli.
 */
import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Activity, WifiOff, Wifi, Pause, Play, Bot, Mail, Moon,
} from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { ConnectionStatusBar } from "@/components/layout/ConnectionStatusBar";
import { ActiveProcessIndicator } from "@/components/layout/ActiveProcessIndicator";

interface OutreachQueue {
  pendingCount: number;
  processing: boolean;
  paused: boolean;
  setPaused: (v: boolean) => void;
}
interface GlobalSyncState {
  nightPause: boolean;
  isNightTime: boolean;
  manualOverride: boolean;
  toggleNightPause: () => void;
  resumeMinutes: number;
}

interface Props {
  onAiClick: () => void;
  outreachQueue: OutreachQueue;
  globalSync: GlobalSyncState;
}

export function StatusPill({ onAiClick, outreachQueue, globalSync }: Props): React.ReactElement {
  const isOnline = useOnlineStatus();

  // Determina colore globale
  const hasIssue = !isOnline || outreachQueue.paused || globalSync.nightPause;
  const isBusy = outreachQueue.processing || outreachQueue.pendingCount > 0;
  const dotColor = !isOnline
    ? "bg-destructive"
    : hasIssue
      ? "bg-amber-500"
      : isBusy
        ? "bg-primary animate-pulse"
        : "bg-emerald-500";

  const summary = !isOnline
    ? "Offline"
    : outreachQueue.paused
      ? "Coda in pausa"
      : globalSync.nightPause
        ? "Pausa notturna"
        : isBusy
          ? `${outreachQueue.pendingCount} in coda`
          : "Tutto OK";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs"
          aria-label={`Stato sistema: ${summary}`}
        >
          <span className={`inline-block h-2 w-2 rounded-full ${dotColor}`} />
          {outreachQueue.pendingCount > 0 && (
            <Badge variant="outline" className="h-4 px-1 text-[10px] tabular-nums">
              {outreachQueue.pendingCount}
            </Badge>
          )}
          <span className="hidden xl:inline text-muted-foreground">{summary}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[26rem] max-w-[calc(100vw-1rem)] p-3 space-y-3">
        <div className="flex items-center justify-between border-b border-border/40 pb-2">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <Wifi className="h-4 w-4 text-emerald-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-destructive" />
            )}
            <span className="text-sm font-medium">{isOnline ? "Online" : "Offline"}</span>
          </div>
          <Badge variant={hasIssue ? "outline" : "secondary"} className="text-[10px]">
            {summary}
          </Badge>
        </div>

        {/* Outreach queue */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Outreach queue</span>
            <Badge variant="outline" className="h-4 px-1 text-[10px] tabular-nums">
              {outreachQueue.pendingCount}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px]"
            onClick={() => outreachQueue.setPaused(!outreachQueue.paused)}
          >
            {outreachQueue.paused ? (
              <><Play className="h-3 w-3 mr-1" /> Riprendi</>
            ) : (
              <><Pause className="h-3 w-3 mr-1" /> Pausa</>
            )}
          </Button>
        </div>

        {/* Night pause */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Moon className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Pausa notturna</span>
            {globalSync.isNightTime && <Badge variant="outline" className="h-4 px-1 text-[10px]">notte</Badge>}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px]"
            onClick={globalSync.toggleNightPause}
          >
            {globalSync.nightPause ? "Disattiva" : "Attiva"}
          </Button>
        </div>

        {/* AI shortcut */}
        <div className="flex items-center justify-between text-xs border-t border-border/40 pt-2">
          <div className="flex items-center gap-2">
            <Bot className="h-3.5 w-3.5 text-muted-foreground" />
            <span>AI Assistant</span>
          </div>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={onAiClick}>
            Apri
          </Button>
        </div>

        {/* Detail bar (riusa componenti legacy per non perdere info) */}
        <div className="border-t border-border/40 pt-2 space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Activity className="h-3 w-3" /> Dettagli runtime
          </div>
          <div className="flex flex-wrap items-center gap-1.5 [&_*]:!flex-wrap [&_*]:max-w-full">
            <ActiveProcessIndicator />
            <ConnectionStatusBar
              onAiClick={onAiClick}
              outreachQueue={outreachQueue}
              nightPause={globalSync.nightPause}
              isNightTime={globalSync.isNightTime}
              manualOverride={globalSync.manualOverride}
              onToggleNightPause={globalSync.toggleNightPause}
              resumeMinutes={globalSync.resumeMinutes}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}