import { appendLog } from "./terminalLog";
import { markRequestSent } from "@/lib/wcaCheckpoint";

/**
 * Strict session verification for download processor.
 * Extension-only — no server-side fallback.
 * Returns true only if extension is present AND session is authenticated.
 */
export async function verifyWcaSession(
  jobId: string,
  isAvailable: boolean,
  checkAvailable: () => Promise<boolean>,
): Promise<boolean> {
  const extOk = isAvailable || await checkAvailable();

  if (!extOk) {
    await appendLog(jobId, "WARN", "❌ Estensione Chrome non rilevata — impossibile verificare la sessione");
    return false;
  }

  // Verify session via extension
  const verify = () =>
    new Promise<any>((resolve) => {
      const requestId = `verifySession_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const timer = setTimeout(() => resolve({ success: false }), 30000);
      const handler = (event: MessageEvent) => {
        if (
          event.source !== window ||
          event.data?.direction !== "from-extension" ||
          event.data?.requestId !== requestId
        ) return;
        clearTimeout(timer);
        window.removeEventListener("message", handler);
        resolve(event.data?.response || { success: false });
      };
      window.addEventListener("message", handler);
      window.postMessage({ direction: "from-webapp", action: "verifySession", requestId }, "*");
    });

  const result = await verify();
  markRequestSent();
  if (result.success && result.authenticated) {
    await appendLog(jobId, "INFO", "✅ Sessione WCA attiva");
    return true;
  }

  // Auto-login attempt via extension
  await appendLog(jobId, "INFO", "🔑 Tentativo auto-login (estensione)...");
  try {
    const { fetchWcaCredentials } = await import("@/lib/wcaCredentials");
    const creds = await fetchWcaCredentials();
    if (creds) {
      const loginOk = await new Promise<boolean>((resolve) => {
        const requestId = `autoLogin_${Date.now()}`;
        const timer = setTimeout(() => resolve(false), 45000);
        const handler = (event: MessageEvent) => {
          if (
            event.source !== window ||
            event.data?.direction !== "from-extension" ||
            event.data?.requestId !== requestId
          ) return;
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
      markRequestSent();

      if (loginOk) {
        const retry = await verify();
        markRequestSent();
        if (retry.success && retry.authenticated) {
          await appendLog(jobId, "INFO", "✅ Sessione attiva dopo auto-login (estensione)");
          return true;
        }
      }
    } else {
      await appendLog(jobId, "WARN", "⚠️ Credenziali WCA non disponibili (non configurate o sessione scaduta)");
    }
  } catch {
    // Fall through
  }

  await appendLog(jobId, "WARN", "❌ Sessione WCA non attivabile — estensione presente ma login fallito");
  return false;
}
