/**
 * WCA session hook — extension-first with DB fallback.
 * If extension ping fails, checks wca_session_status in app_settings.
 * Exposes granular state: extensionAvailable, sessionActive, isChecking, lastError.
 */
import { useState, useCallback, useRef } from "react";
import { useExtensionBridge } from "./useExtensionBridge";
import { supabase } from "@/integrations/supabase/client";

async function checkServerSessionStatus(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "wca_session_status")
      .maybeSingle();
    if (error || !data) return false;
    return data.value === "ok";
  } catch {
    return false;
  }
}

export function useWcaSession() {
  const [extensionAvailable, setExtensionAvailable] = useState<boolean | null>(null);
  const [sessionActive, setSessionActive] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const checkingRef = useRef(false);
  const { isAvailable, checkAvailable, verifySession, syncCookie } = useExtensionBridge();

  /**
   * Session verification for download operations.
   * Extension-first with server-side DB fallback.
   */
  const ensureSession = useCallback(async (): Promise<boolean> => {
    if (checkingRef.current) return sessionActive ?? false;
    checkingRef.current = true;
    setIsChecking(true);
    setLastError(null);

    try {
      // Step 1: Check extension availability
      console.log("[WcaSession] Step 1: Checking extension availability...");
      const extOk = isAvailable || await checkAvailable();
      setExtensionAvailable(extOk);

      if (!extOk) {
        // ── DB FALLBACK: extension not responding, check server-side session status ──
        console.log("[WcaSession] ⚠️ Extension not found, checking DB fallback...");
        const serverOk = await checkServerSessionStatus();
        if (serverOk) {
          console.log("[WcaSession] ✅ DB fallback: wca_session_status = ok — session considered active");
          setSessionActive(true);
          return true;
        }
        const msg = "Sessione WCA non attiva. Estensione non rilevata e sessione server scaduta.";
        console.warn("[WcaSession] ❌ DB fallback failed:", msg);
        setLastError(msg);
        setSessionActive(false);
        return false;
      }
      console.log("[WcaSession] ✅ Step 1: Extension found");

      // Step 2: Verify current session
      console.log("[WcaSession] Step 2: Verifying session...");
      const result = await verifySession();
      if (result.success && result.authenticated) {
        console.log("[WcaSession] ✅ Step 2: Session active");
        setSessionActive(true);
        return true;
      }
      console.log("[WcaSession] ⚠️ Step 2: Session not active, proceeding to auto-login");

      // Step 3: Fetch credentials
      console.log("[WcaSession] Step 3: Fetching WCA credentials...");
      try {
        const { fetchWcaCredentials } = await import("@/lib/wcaCredentials");
        const creds = await fetchWcaCredentials();

        if (!creds) {
          const msg = "Credenziali WCA non configurate. Vai in Impostazioni → WCA per inserirle.";
          console.warn("[WcaSession] ❌ Step 3 failed:", msg);
          setLastError(msg);
          setSessionActive(false);
          return false;
        }
        console.log("[WcaSession] ✅ Step 3: Credentials fetched");

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

        // Step 4: Auto-login attempt
        console.log("[WcaSession] Step 4: Attempting auto-login...");
        if (loginResult) {
          await syncCookie();
          const retry = await verifySession();
          if (retry.success && retry.authenticated) {
            console.log("[WcaSession] ✅ Step 4: Session active after auto-login");
            setSessionActive(true);
            return true;
          }
          console.warn("[WcaSession] ⚠️ Step 4: Auto-login succeeded but session verify failed");
        } else {
          console.warn("[WcaSession] ❌ Step 4: Auto-login returned false (timeout or extension error)");
        }
      } catch (err) {
        console.warn("[WcaSession] ❌ Auto-login exception:", err);
      }

      const msg = "Auto-login WCA fallito. Prova il login manuale su wcaworld.com oppure clicca 'Connetti' nel popup dell'estensione.";
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
