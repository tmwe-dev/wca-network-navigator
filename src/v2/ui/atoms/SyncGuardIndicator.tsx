import { useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  getGuardSnapshot,
  type GuardChannel,
  type GuardSnapshot,
} from "@/lib/syncGuard";

/**
 * SyncGuardIndicator — badge "poliziotto" che segnala che il sistema sta
 * rispettando i tempi umani per il canale dato. Lampeggia rosso 1s in caso
 * di tentativi sovrapposti (evento `sync-guard-blocked`).
 */
export function SyncGuardIndicator({
  channel,
  className,
}: {
  channel: GuardChannel;
  className?: string;
}) {
  const [snap, setSnap] = useState<GuardSnapshot>(() => getGuardSnapshot(channel));
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    const onState = (e: Event) => {
      const detail = (e as CustomEvent).detail as GuardSnapshot | undefined;
      if (!detail || detail.channel !== channel) return;
      setSnap(detail);
    };
    const onBlocked = (e: Event) => {
      const detail = (e as CustomEvent).detail as { channel: GuardChannel } | undefined;
      if (!detail || detail.channel !== channel) return;
      setFlash(true);
      window.setTimeout(() => setFlash(false), 1000);
    };
    window.addEventListener("sync-guard-state", onState);
    window.addEventListener("sync-guard-blocked", onBlocked);
    return () => {
      window.removeEventListener("sync-guard-state", onState);
      window.removeEventListener("sync-guard-blocked", onBlocked);
    };
  }, [channel]);

  const isWaiting = snap.state === "waiting";
  const isActive = snap.state === "active";
  const seconds = Math.ceil(snap.waitMsRemaining / 1000);

  const colorClass = flash
    ? "bg-red-500/20 text-red-600 border-red-500/40 animate-pulse"
    : isWaiting
      ? "bg-amber-500/15 text-amber-700 border-amber-500/30 animate-pulse"
      : isActive
        ? "bg-blue-500/15 text-blue-700 border-blue-500/30 animate-pulse"
        : "bg-muted/40 text-muted-foreground border-border";

  const Icon = flash ? ShieldAlert : isWaiting ? Clock : ShieldCheck;

  const label = flash
    ? "Aspetta…"
    : isWaiting
      ? `Pausa ${seconds}s`
      : isActive
        ? "Controllo attivo"
        : "Controllo pronto";

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-medium leading-none cursor-default select-none",
              colorClass,
              className,
            )}
            aria-label={`Controllo tempi ${channel}: ${label}`}
          >
            <Icon className="w-2.5 h-2.5" />
            <span className="whitespace-nowrap">{label}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[260px] text-xs">
          <p className="font-semibold mb-1">Controllo tempi umani — {channel}</p>
          <p className="text-muted-foreground">
            Una sola operazione per volta. Il sistema rispetta automaticamente
            le pause tra apertura, lettura e chiusura dei thread, come farebbe
            un essere umano. Niente aperture multiple, niente sovrapposizioni.
          </p>
          {snap.step && (
            <p className="mt-1">
              <span className="text-muted-foreground">Step:</span>{" "}
              <span className="font-medium">{snap.step}</span>
            </p>
          )}
          {isWaiting && (
            <p className="mt-0.5">
              <span className="text-muted-foreground">Cooldown:</span>{" "}
              <span className="font-medium">{seconds}s residui</span>
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}