import { appendLog } from "./terminalLog";

/**
 * V2: Session verification — lightweight, no WCA calls.
 * Uses extension's verifySession which checks cookies locally,
 * only falls back to auto-login if needed.
 * 
 * REMOVED: markRequestSent() calls — session verification doesn't
 * hit WCA profile pages, so it shouldn't trigger the checkpoint delay.
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

  // Verify session via extension (local cookie check — no WCA call)
  const verify = () =>
    new Promise<any>((resolve) => {
      const requestId = `verifySession_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const timer = setTimeout(() => resolve({ success: false }), 15_000);
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
      window.postMessage({ direction: "from-webapp", action: "verifySession", requestId }, window.location.origin);
    });

  const result = await verify();
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

      if (loginOk) {
        const retry = await verify();
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
