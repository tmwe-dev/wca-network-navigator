import { appendLog } from "./terminalLog";
import { markRequestSent } from "@/lib/wcaCheckpoint";

/**
 * Verifies the WCA session via the Chrome extension.
 * If the session is expired, attempts auto-login with stored credentials.
 * Returns true if session is active, false otherwise.
 */
export async function verifyWcaSession(
  jobId: string,
  isAvailable: boolean,
  checkAvailable: () => Promise<boolean>,
): Promise<boolean> {
  const extOk = isAvailable || await checkAvailable();
  if (!extOk) {
    await appendLog(jobId, "WARN", "❌ Estensione Chrome non disponibile");
    return false;
  }

  const verify = () =>
    new Promise<any>((resolve) => {
      const requestId = `verifySession_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const timer = setTimeout(() => resolve({ success: false }), 30000);
      const handler = (event: MessageEvent) => {
        if (
          event.source !== window ||
          event.data?.direction !== "from-extension" ||
          event.data?.requestId !== requestId
        )
          return;
        clearTimeout(timer);
        window.removeEventListener("message", handler);
        resolve(event.data?.response || { success: false });
      };
      window.addEventListener("message", handler);
      window.postMessage({ direction: "from-webapp", action: "verifySession", requestId }, "*");
    });

  const result = await verify();
  markRequestSent(); // Register checkpoint after WCA interaction
  if (result.success && result.authenticated) {
    await appendLog(jobId, "INFO", "✅ Sessione WCA attiva");
    return true;
  }

  // ── Auto-login attempt ──
  await appendLog(jobId, "INFO", "🔑 Tentativo auto-login...");
  try {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-wca-credentials`;
    const res = await fetch(url, {
      headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
    });
    const creds = await res.json();
    if (!creds.username || !creds.password) {
      await appendLog(jobId, "WARN", "❌ Credenziali WCA non configurate");
      return false;
    }

    const loginOk = await new Promise<boolean>((resolve) => {
      const requestId = `autoLogin_${Date.now()}`;
      const timer = setTimeout(() => resolve(false), 45000);
      const handler = (event: MessageEvent) => {
        if (
          event.source !== window ||
          event.data?.direction !== "from-extension" ||
          event.data?.requestId !== requestId
        )
          return;
        clearTimeout(timer);
        window.removeEventListener("message", handler);
        resolve(event.data?.response?.success === true);
      };
      window.addEventListener("message", handler);
      window.postMessage(
        { direction: "from-webapp", action: "autoLogin", requestId, username: creds.username, password: creds.password },
        "*"
      );
    });
    markRequestSent(); // Register checkpoint after auto-login WCA interaction

    if (!loginOk) {
      await appendLog(jobId, "WARN", "❌ Auto-login fallito");
      return false;
    }

    const retry = await verify();
    markRequestSent(); // Register checkpoint after retry verification
    if (retry.success && retry.authenticated) {
      await appendLog(jobId, "INFO", "✅ Sessione attiva dopo auto-login");
      return true;
    }
    await appendLog(jobId, "WARN", "❌ Sessione ancora non attiva");
    return false;
  } catch {
    await appendLog(jobId, "WARN", "❌ Errore auto-login");
    return false;
  }
}
