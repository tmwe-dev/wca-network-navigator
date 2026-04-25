/**
 * PWAUpdatePrompt — singleton banner che notifica l'utente quando una nuova
 * versione del service worker è disponibile, e permette l'aggiornamento immediato.
 * Risolve il problema di cache stale dopo Publish.
 */
import { useEffect, useState } from "react";
import { createLogger } from "@/lib/log";

const log = createLogger("PWAUpdatePrompt");

export function PWAUpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const isInIframe = (() => {
      try {
        return window.self !== window.top;
      } catch {
        return true;
      }
    })();

    const isPreviewHost =
      window.location.hostname.includes("id-preview--") ||
      window.location.hostname.includes("lovableproject.com");

    if (isInIframe || isPreviewHost) {
      // Non registrare SW in preview/iframe per evitare interferenze
      return;
    }

    if (!("serviceWorker" in navigator)) return;

    (async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        if (cancelled) return;

        const onUpdateFound = () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state !== "installed" || !navigator.serviceWorker.controller) return;
            log.info("new version available");
            setWaitingWorker(worker);
            setNeedRefresh(true);
          });
        };

        registration.addEventListener("updatefound", onUpdateFound);
        navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload());
        intervalId = setInterval(() => {
          registration.update().catch(() => undefined);
        }, 60_000);
      } catch (error) {
        log.warn("SW register failed", { message: error instanceof Error ? error.message : String(error) });
      }
    })();

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  if (!needRefresh || !waitingWorker) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] max-w-sm rounded-lg border border-primary/40 bg-card shadow-2xl p-4 animate-in slide-in-from-bottom-4">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">Nuova versione disponibile</p>
          <p className="text-xs text-muted-foreground mt-1">
            È stata pubblicata una nuova versione dell'app. Aggiorna ora per vedere le ultime modifiche.
          </p>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => waitingWorker.postMessage({ type: "SKIP_WAITING" })}
          className="flex-1 bg-primary text-primary-foreground text-sm py-2 px-3 rounded-md hover:bg-primary/90 transition-colors font-medium"
        >
          Aggiorna ora
        </button>
        <button
          onClick={() => setNeedRefresh(false)}
          className="bg-muted text-muted-foreground text-sm py-2 px-3 rounded-md hover:bg-muted/80 transition-colors"
        >
          Più tardi
        </button>
      </div>
    </div>
  );
}
