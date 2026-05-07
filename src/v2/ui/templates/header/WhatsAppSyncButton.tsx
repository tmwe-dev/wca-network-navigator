/**
 * WhatsAppSyncButton — Icona WA in header globale.
 *
 * Stati visivi:
 *  - grigia statica  → nessun nuovo messaggio
 *  - verde + pulse + badge → N nuovi messaggi sincronizzati non visti
 *  - rossa muted     → servizio scollegato
 *  - spinner         → sync in corso
 *
 * Click → dispatch `wa-sync-trigger` (consumato da useWhatsAppAutoSync se attivo)
 *         + reset indicatore.
 */
import * as React from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWhatsAppNewMessagesIndicator } from "@/hooks/useWhatsAppNewMessagesIndicator";
import { useWhatsAppExtensionBridge } from "@/hooks/useWhatsAppExtensionBridge";

export function WhatsAppSyncButton(): React.ReactElement {
  const { isAvailable, isAuthenticated } = useWhatsAppExtensionBridge();
  const { count, pulse, clear } = useWhatsAppNewMessagesIndicator();
  const [syncing, setSyncing] = React.useState(false);

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

  const connected = isAvailable && isAuthenticated;
  const hasNew = count > 0;

  const colorClass = !connected
    ? "text-destructive/60"
    : hasNew
      ? "text-emerald-500"
      : "text-foreground/70 hover:text-primary";

  const title = !isAvailable
    ? "WhatsApp: estensione non rilevata"
    : !isAuthenticated
      ? "WhatsApp: sessione non autenticata"
      : syncing
        ? "Sincronizzazione WhatsApp in corso…"
        : hasNew
          ? `WhatsApp: ${count} nuovi messaggi · click per sync`
          : "Sincronizza WhatsApp ora";

  const handleClick = React.useCallback(() => {
    clear();
    if (connected) {
      window.dispatchEvent(new CustomEvent("wa-sync-trigger"));
    }
  }, [clear, connected]);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClick}
      disabled={!connected && !hasNew}
      aria-label={title}
      title={title}
      className={cn("relative h-7 w-7 transition-colors", colorClass)}
    >
      {syncing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <MessageCircle className={cn("h-4 w-4", hasNew && pulse && "animate-pulse")} />
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
  );
}