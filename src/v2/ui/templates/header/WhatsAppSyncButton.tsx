/**
 * GlobalSyncButton — "Scarica ora" globale (Email + WhatsApp + LinkedIn).
 *
 * Click → richiesta IMMEDIATA su tutti e 3 i canali in parallelo:
 *  - Email   : invoca `check-inbox` direttamente (single-flight via callCheckInbox)
 *  - WhatsApp: dispatch `wa-sync-trigger` (consumato da useWhatsAppAutoSync)
 *  - LinkedIn: dispatch `li-sync-trigger` (consumato da useLinkedInAutoSync)
 *
 * Funziona "liberamente" anche quando gli auto-sync sono in pausa: gli
 * adaptive-sync hook ascoltano comunque il trigger event e processano la
 * richiesta senza resettare la sequenza programmata.
 *
 * L'indicatore mantiene il badge "nuovi messaggi WA" per retrocompat.
 * Esportato anche come `WhatsAppSyncButton` per non rompere call site esistenti.
 */
import * as React from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWhatsAppNewMessagesIndicator } from "@/hooks/useWhatsAppNewMessagesIndicator";
import { useWhatsAppExtensionBridge } from "@/hooks/useWhatsAppExtensionBridge";
import { useLinkedInExtensionBridge } from "@/hooks/useLinkedInExtensionBridge";
import { callCheckInbox } from "@/lib/checkInbox";
import { toast } from "sonner";
import { createLogger } from "@/lib/log";
import { SyncGuardIndicator } from "@/v2/ui/atoms/SyncGuardIndicator";

const log = createLogger("GlobalSyncButton");

export function GlobalSyncButton(): React.ReactElement {
  const wa = useWhatsAppExtensionBridge();
  const li = useLinkedInExtensionBridge();
  const { count, pulse, clear } = useWhatsAppNewMessagesIndicator();
  const [syncing, setSyncing] = React.useState(false);

  // Mantiene lo spinner sincronizzato con WA auto-sync se in corso da altrove.
  React.useEffect(() => {
    function onStart() { setSyncing(true); }
    function onDone() { setSyncing(false); }
    window.addEventListener("wa-sync-trigger", onStart);
    window.addEventListener("wa-sync-completed", onDone);
    return () => {
      window.removeEventListener("wa-sync-trigger", onStart);
      window.removeEventListener("wa-sync-completed", onDone);
    };
  }, []);

  const waConnected = wa.isAvailable && wa.isAuthenticated;
  const liConnected = li.isAvailable;
  const hasNew = count > 0;

  const colorClass = hasNew
    ? "text-emerald-500"
    : "text-foreground/70 hover:text-primary";

  const title = syncing
    ? "Sincronizzazione in corso…"
    : hasNew
      ? `Scarica ora · ${count} nuovi messaggi WA`
      : "Scarica ora (Email · WhatsApp · LinkedIn)";

  const handleClick = React.useCallback(async () => {
    clear();
    setSyncing(true);
    try {
      // Email: chiamata diretta single-flight. WA/LI: trigger event ai loro
      // adaptive-sync (non resettano sequenza). Tutto in parallelo.
      const tasks: Array<Promise<unknown>> = [];
      tasks.push(
        callCheckInbox().catch((e) => {
          log.warn("email sync failed", { error: e instanceof Error ? e.message : String(e) });
          return null;
        }),
      );
      if (waConnected) {
        window.dispatchEvent(new CustomEvent("wa-sync-trigger"));
      }
      if (liConnected) {
        window.dispatchEvent(new CustomEvent("li-sync-trigger"));
      }
      await Promise.allSettled(tasks);
      toast.success("Sincronizzazione avviata", {
        description: `Email${waConnected ? " · WhatsApp" : ""}${liConnected ? " · LinkedIn" : ""}`,
      });
    } finally {
      setSyncing(false);
    }
  }, [clear, waConnected, liConnected]);

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={handleClick}
        disabled={syncing}
        aria-label={title}
        title={title}
        className={cn("relative h-7 w-7 transition-colors", colorClass)}
      >
        {syncing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className={cn("h-4 w-4", hasNew && pulse && "animate-pulse")} />
        )}
        {hasNew && (
          <span
            className={cn(
              "absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-1 rounded-full",
              "bg-emerald-500 text-[9px] leading-[14px] text-white font-semibold text-center",
              pulse && "animate-pulse",
            )}
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </Button>
      {waConnected ? (
        <SyncGuardIndicator channel="whatsapp" iconOnly />
      ) : liConnected ? (
        <SyncGuardIndicator channel="linkedin" iconOnly />
      ) : null}
    </div>
  );
}

/** Alias di retrocompatibilità: il bottone ora copre tutti e 3 i canali. */
export const WhatsAppSyncButton = GlobalSyncButton;