import { appendLog } from "./terminalLog";
import { markRequestSent } from "@/lib/wcaCheckpoint";

/**
 * Try server-side WCA auto-login via edge function (no extension needed).
 */
async function tryServerSideLogin(): Promise<boolean> {
  try {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wca-auto-login`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
      },
    });
    const data = await res.json();
    return data.success === true && data.authenticated === true;
  } catch {
    return false;
  }
}

/**
 * Verifies the WCA session via the Chrome extension.
 * If the session is expired, attempts auto-login with stored credentials.
 * Falls back to server-side login if extension is unavailable.
 * Returns true if session is active, false otherwise.
 */
export async function verifyWcaSession(
  jobId: string,
  isAvailable: boolean,
  checkAvailable: () => Promise<boolean>,
): Promise<boolean> {
  const extOk = isAvailable || await checkAvailable();

  if (extOk) {
    // Extension path
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

    // Extension auto-login attempt
    await appendLog(jobId, "INFO", "🔑 Tentativo auto-login (estensione)...");
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-wca-credentials`;
      const res = await fetch(url, {
        headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      });
      const creds = await res.json();
      if (creds.username && creds.password) {
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
      }
    } catch {
      // Fall through to server-side
    }
  }

  // Server-side fallback
  await appendLog(jobId, "INFO", "🔑 Tentativo auto-login (server-side)...");
  const serverOk = await tryServerSideLogin();
  if (serverOk) {
    await appendLog(jobId, "INFO", "✅ Sessione WCA attiva (server-side)");
    return true;
  }

  await appendLog(jobId, "WARN", "❌ Sessione WCA non attivabile");
  return false;
}
