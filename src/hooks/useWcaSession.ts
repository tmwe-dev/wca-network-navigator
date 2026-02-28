/**
 * WCA session hook — strict extension-only path for downloads.
 * Exposes granular state: extensionAvailable, sessionActive, isChecking, lastError.
 */
import { useState, useCallback, useRef } from "react";
import { useExtensionBridge } from "./useExtensionBridge";

export function useWcaSession() {
  const [extensionAvailable, setExtensionAvailable] = useState<boolean | null>(null);
  const [sessionActive, setSessionActive] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const checkingRef = useRef(false);
  const { isAvailable, checkAvailable, verifySession, syncCookie } = useExtensionBridge();

  /**
   * Strict session verification for download operations.
   * Extension-only: no server-side fallback.
   * Returns true only if extension is present AND session is authenticated.
   */
  const ensureSession = useCallback(async (): Promise<boolean> => {
    if (checkingRef.current) return sessionActive ?? false;
    checkingRef.current = true;
    setIsChecking(true);
    setLastError(null);

    try {
      // Step 1: Check extension availability
      const extOk = isAvailable || await checkAvailable();
      setExtensionAvailable(extOk);

      if (!extOk) {
        const msg = "Estensione Chrome non rilevata. Installa l'estensione WCA dalla pagina dedicata.";
        setLastError(msg);
        setSessionActive(false);
        return false;
      }

      // Step 2: Verify current session
      const result = await verifySession();
      if (result.success && result.authenticated) {
        console.log("[WcaSession] ✅ Session active (extension)");
        setSessionActive(true);
        return true;
      }

      // Step 3: Auto-login via extension
      console.log("[WcaSession] Session expired, attempting extension auto-login...");
      try {
        const { fetchWcaCredentials } = await import("@/lib/wcaCredentials");
        const creds = await fetchWcaCredentials();

        if (!creds) {
          const msg = "Credenziali WCA non configurate o sessione scaduta. Vai nelle Impostazioni per inserirle.";
          setLastError(msg);
          setSessionActive(false);
          return false;
        }

        const loginResult = await new Promise<boolean>((resolve) => {
          const requestId = `autoLogin_${Date.now()}`;
          const timeout = setTimeout(() => resolve(false), 45000);
          const handler = (event: MessageEvent) => {
            if (event.source !== window) return;
            if (event.data?.direction !== "from-extension") return;
            if (event.data?.requestId !== requestId) return;
            clearTimeout(timeout);
            window.removeEventListener("message", handler);
            resolve(event.data?.response?.success === true);
          };
          window.addEventListener("message", handler);
          window.postMessage({
            direction: "from-webapp",
            action: "autoLogin",
            requestId,
            username: creds.username,
            password: creds.password,
          }, "*");
        });

        if (loginResult) {
          await syncCookie();
          // Step 4: Re-verify after login
          const retry = await verifySession();
          if (retry.success && retry.authenticated) {
            console.log("[WcaSession] ✅ Session active after auto-login");
            setSessionActive(true);
            return true;
          }
        }
      } catch (err) {
        console.warn("[WcaSession] Extension auto-login failed:", err);
      }

      const msg = "Sessione WCA non attivabile. Prova a fare il login manuale su wcaworld.com oppure clicca 'Connetti' nel popup dell'estensione.";
      setLastError(msg);
      setSessionActive(false);
      return false;
    } finally {
      checkingRef.current = false;
      setIsChecking(false);
    }
  }, [isAvailable, checkAvailable, verifySession, syncCookie, sessionActive]);

  return {
    extensionAvailable,
    sessionActive,
    isChecking,
    lastError,
    ensureSession,
    /** Alias for backward compat */
    isSessionActive: sessionActive,
  };
}
