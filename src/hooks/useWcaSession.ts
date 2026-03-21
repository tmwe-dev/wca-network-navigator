/**
 * V4: WcaSession hook is now a thin wrapper.
 * No session gates. Only provides status for UI indicators.
 */
import { useState, useCallback } from "react";
import { useExtensionBridge } from "./useExtensionBridge";

export function useWcaSession() {
  const [extensionAvailable, setExtensionAvailable] = useState<boolean | null>(null);
  const [sessionActive, setSessionActive] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const { checkAvailable, verifySession } = useExtensionBridge();

  const ensureSession = useCallback(async (): Promise<boolean> => {
    setIsChecking(true);
    setLastError(null);
    try {
      const extOk = await checkAvailable();
      setExtensionAvailable(extOk);
      if (!extOk) { setLastError("Estensione non rilevata."); setSessionActive(false); return false; }
      const result = await verifySession();
      const ok = !!(result.success && result.authenticated);
      setSessionActive(ok);
      if (!ok) setLastError("Sessione WCA non attiva.");
      return ok;
    } finally { setIsChecking(false); }
  }, [checkAvailable, verifySession]);

  return { extensionAvailable, sessionActive, isChecking, lastError, ensureSession, isSessionActive: sessionActive };
}
