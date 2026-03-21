/**
 * V3: Minimal WCA session hook.
 * Only checks extension availability + cookie presence.
 * No auto-login. No sync cookie. No credential fetching.
 */
import { useState, useCallback, useRef } from "react";
import { useExtensionBridge } from "./useExtensionBridge";

export function useWcaSession() {
  const [extensionAvailable, setExtensionAvailable] = useState<boolean | null>(null);
  const [sessionActive, setSessionActive] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const checkingRef = useRef(false);
  const { checkAvailable, verifySession } = useExtensionBridge();

  const ensureSession = useCallback(async (): Promise<boolean> => {
    if (checkingRef.current) return sessionActive ?? false;
    checkingRef.current = true;
    setIsChecking(true);
    setLastError(null);

    try {
      const extOk = await checkAvailable();
      setExtensionAvailable(extOk);
      if (!extOk) {
        setLastError("Estensione Chrome non rilevata.");
        setSessionActive(false);
        return false;
      }

      const result = await verifySession();
      if (result.success && result.authenticated) {
        setSessionActive(true);
        return true;
      }

      setLastError("Sessione WCA scaduta. Effettua il login su wcaworld.com.");
      setSessionActive(false);
      return false;
    } finally {
      checkingRef.current = false;
      setIsChecking(false);
    }
  }, [checkAvailable, verifySession, sessionActive]);

  return {
    extensionAvailable,
    sessionActive,
    isChecking,
    lastError,
    ensureSession,
    isSessionActive: sessionActive,
  };
}
