/**
 * V5: WcaSession — ora usa wca-app bridge (Claude Engine).
 * 🤖 Claude Engine — Diario di bordo #4
 * 
 * Non dipende più dall'estensione Chrome.
 * Testa la connessione chiamando wca-app.vercel.app/api/login.
 */
import { useState, useCallback } from "react";
import { createLogger } from "@/lib/log";

const log = createLogger("useWcaSession");

const WCA_APP_LOGIN = "https://wca-app.vercel.app/api/login";

export function useWcaSession() {
  const [extensionAvailable, setExtensionAvailable] = useState<boolean | null>(true);
  const [sessionActive, setSessionActive] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const ensureSession = useCallback(async (): Promise<boolean> => {
    setIsChecking(true);
    setLastError(null);
    try {
      const res = await fetch(WCA_APP_LOGIN, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await res.json();
      if (data.success && data.cookies) {
        setExtensionAvailable(true);
        setSessionActive(true);
        setWcaCookie(data.cookies);
        return true;
      }
      setSessionActive(false);
      setLastError(data.error || "Login WCA fallito");
      return false;
    } catch (err) {
      setSessionActive(false);
      setLastError("wca-app non raggiungibile");
      return false;
    } finally {
      setIsChecking(false);
    }
  }, []);

  return {
    extensionAvailable,
    sessionActive,
    isChecking,
    lastError,
    ensureSession,
    isSessionActive: sessionActive,
  };
}
