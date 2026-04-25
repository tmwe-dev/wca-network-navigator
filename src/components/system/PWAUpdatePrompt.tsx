/**
 * PWAUpdatePrompt — singleton banner che notifica l'utente quando una nuova
 * versione del service worker è disponibile, e permette l'aggiornamento immediato.
 * Risolve il problema di cache stale dopo Publish.
 */
import { useEffect, useState } from "react";
import { createLogger } from "@/lib/log";

const log = createLogger("PWAUpdatePrompt");

type RegisterSWModule = typeof import("virtual:pwa-register");

export function PWAUpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [updateSW, setUpdateSW] = useState<((reload?: boolean) => Promise<void>) | null>(null);

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

    (async () => {
      try {
        const mod = (await import(/* @vite-ignore */ "virtual:pwa-register")) as RegisterSWModule;
        if (cancelled) return;
        const update = mod.registerSW({
          immediate: true,
          onNeedRefresh() {
            log.info("new version available");
            setNeedRefresh(true);
          },
          onRegisteredSW(_swUrl, registration) {
            // Polling ogni 60s per check update
            if (!registration) return;
            intervalId = setInterval(() => {
              registration.update().catch(() => undefined);
            }, 60_000);
          },
          onRegisterError(error) {
            log.warn("SW register failed", { message: error instanceof Error ? error.message : String(error) });
          },
        });
        setUpdateSW(() => update);
      } catch (error) {
        log.warn("PWA register module failed", { message: error instanceof Error ? error.message : String(error) });
      }
    })();

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  if (!needRefresh || !updateSW) return null;

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
          onClick={() => updateSW(true)}
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
