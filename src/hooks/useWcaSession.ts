/**
 * WCA session hook with dual-path: Chrome extension (preferred) or server-side fallback.
 */
import { useState, useCallback, useRef } from "react";
import { useExtensionBridge } from "./useExtensionBridge";

export function useWcaSession() {
  const [isSessionActive, setIsSessionActive] = useState<boolean | null>(null);
  const checkingRef = useRef(false);
  const { isAvailable, checkAvailable, verifySession, syncCookie } = useExtensionBridge();

  /**
   * Try server-side auto-login via edge function.
   * This works even without the Chrome extension — the edge function
   * performs the login server-side and saves the cookie to DB.
   */
  const tryServerSideLogin = useCallback(async (): Promise<boolean> => {
    try {
      console.log("[WcaSession] Trying server-side auto-login...");
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wca-auto-login`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
        },
      });
      const data = await res.json();
      console.log("[WcaSession] Server-side result:", data.message || data.error);
      return data.success === true && data.authenticated === true;
    } catch (err) {
      console.error("[WcaSession] Server-side login error:", err);
      return false;
    }
  }, []);

  const ensureSession = useCallback(async (): Promise<boolean> => {
    if (checkingRef.current) return isSessionActive ?? false;
    checkingRef.current = true;

    try {
      // Path A: Try via Chrome extension
      const extOk = isAvailable || await checkAvailable();

      if (extOk) {
        const result = await verifySession();
        if (result.success && result.authenticated) {
          console.log("[WcaSession] ✅ Session active (extension)");
          setIsSessionActive(true);
          return true;
        }

        // Extension available but session expired — try auto-login via extension
        console.log("[WcaSession] Session expired, attempting extension auto-login...");
        try {
          const credUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-wca-credentials`;
          const credRes = await fetch(credUrl, {
            headers: { "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
          });
          const creds = await credRes.json();

          if (creds.username && creds.password) {
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
              const retry = await verifySession();
              if (retry.success && retry.authenticated) {
                console.log("[WcaSession] ✅ Session active after extension auto-login");
                setIsSessionActive(true);
                return true;
              }
            }
          }
        } catch (err) {
          console.warn("[WcaSession] Extension auto-login failed:", err);
        }
      }

      // Path B: No extension or extension login failed — try server-side
      console.log("[WcaSession] Falling back to server-side login...");
      const serverOk = await tryServerSideLogin();
      if (serverOk) {
        console.log("[WcaSession] ✅ Session active (server-side)");
        setIsSessionActive(true);
        return true;
      }

      console.warn("[WcaSession] ❌ All login methods failed");
      setIsSessionActive(false);
      return false;
    } finally {
      checkingRef.current = false;
    }
  }, [isAvailable, checkAvailable, verifySession, syncCookie, isSessionActive, tryServerSideLogin]);

  return {
    isSessionActive,
    ensureSession,
  };
}
