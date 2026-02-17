/**
 * Simplified WCA session hook.
 * 
 * Single concept: before any WCA operation, open a known WCA page via the
 * Chrome extension and check if it loads with real contacts.
 * If not, attempt auto-login with saved credentials.
 * 
 * No DB polling, no complex state machine, no manual user interaction.
 */
import { useState, useCallback, useRef } from "react";
import { useExtensionBridge } from "./useExtensionBridge";
import { supabase } from "@/integrations/supabase/client";

export function useWcaSession() {
  const [isSessionActive, setIsSessionActive] = useState<boolean | null>(null);
  const checkingRef = useRef(false);
  const { isAvailable, checkAvailable, verifySession, syncCookie } = useExtensionBridge();

  /**
   * Ensures the WCA session is active.
   * 1. Asks extension to open a test WCA profile
   * 2. If contacts are visible → session OK
   * 3. If not → attempt auto-login via extension, then retry
   * 4. Returns true/false. No UI, no dialogs.
   */
  const ensureSession = useCallback(async (): Promise<boolean> => {
    // Prevent concurrent checks
    if (checkingRef.current) return isSessionActive ?? false;
    checkingRef.current = true;

    try {
      // Check extension availability
      const extOk = isAvailable || await checkAvailable();
      if (!extOk) {
        console.warn("[WcaSession] Extension not available");
        setIsSessionActive(false);
        return false;
      }

      // Step 1: Verify session by opening a real WCA profile
      const result = await verifySession();
      
      if (result.success && result.authenticated) {
        console.log("[WcaSession] ✅ Session active");
        setIsSessionActive(true);
        return true;
      }

      // Step 2: Session not active — try auto-login
      console.log("[WcaSession] Session not active, attempting auto-login...");

      // Fetch credentials from DB
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-wca-credentials`;
        const res = await fetch(url, {
          headers: { "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        });
        const creds = await res.json();

        if (!creds.username || !creds.password) {
          console.warn("[WcaSession] No WCA credentials saved");
          setIsSessionActive(false);
          return false;
        }

        // Ask extension to perform auto-login
        // The extension's "autoLogin" action fills in the login form and submits
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

        if (!loginResult) {
          console.warn("[WcaSession] Auto-login failed");
          setIsSessionActive(false);
          return false;
        }

        // Step 3: After login, sync cookie and verify again
        await syncCookie();
        const retryResult = await verifySession();
        
        if (retryResult.success && retryResult.authenticated) {
          console.log("[WcaSession] ✅ Session active after auto-login");
          setIsSessionActive(true);
          return true;
        }

        console.warn("[WcaSession] Session still not active after auto-login");
        setIsSessionActive(false);
        return false;
      } catch (err) {
        console.error("[WcaSession] Auto-login error:", err);
        setIsSessionActive(false);
        return false;
      }
    } finally {
      checkingRef.current = false;
    }
  }, [isAvailable, checkAvailable, verifySession, syncCookie, isSessionActive]);

  return {
    isSessionActive,
    ensureSession,
  };
}
