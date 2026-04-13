/**
 * PWAInstallPrompt — Shows a banner prompting users to install the PWA.
 * Uses the `beforeinstallprompt` browser event. Only shown after 30s of use.
 */
import { useState, useEffect, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShowPrompt(true), 30000);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = useCallback(() => {
    deferredPrompt?.prompt();
    setShowPrompt(false);
  }, [deferredPrompt]);

  if (!showPrompt || !deferredPrompt) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-card border border-border rounded-lg shadow-lg p-4 z-50">
      <p className="text-sm font-medium mb-2">Installa WCA Navigator</p>
      <p className="text-xs text-muted-foreground mb-3">
        Accesso rapido dalla home del tuo dispositivo
      </p>
      <div className="flex gap-2">
        <button
          onClick={handleInstall}
          className="flex-1 bg-primary text-primary-foreground text-sm py-2 rounded-md hover:bg-primary/90 transition-colors"
        >
          Installa
        </button>
        <button
          onClick={() => setShowPrompt(false)}
          className="flex-1 bg-muted text-muted-foreground text-sm py-2 rounded-md hover:bg-muted/80 transition-colors"
        >
          Non ora
        </button>
      </div>
    </div>
  );
}
