import { appendLog } from "./terminalLog";
import { supabase } from "@/integrations/supabase/client";

/**
 * V3: Session verification with aggressive auto-login.
 * 1. Try extension verify (local cookie check)
 * 2. If no extension → DB fallback (app_settings wca_session_status)
 * 3. If session not active → auto-login via extension
 * 4. If auto-login fails → try DB fallback as last resort
 */

function sendToExtension(action: string, payload: Record<string, any> = {}, timeoutMs = 15_000): Promise<any> {
  return new Promise((resolve) => {
    const requestId = `${action}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const timer = setTimeout(() => {
      window.removeEventListener("message", handler);
      resolve({ success: false, error: "timeout" });
    }, timeoutMs);
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
    window.postMessage(
      { direction: "from-webapp", action, requestId, ...payload },
      window.location.origin
    );
  });
}

async function checkDbSessionStatus(): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "wca_session_status")
      .maybeSingle();
    return data?.value === "ok";
  } catch {
    return false;
  }
}

async function attemptAutoLogin(jobId: string): Promise<boolean> {
  await appendLog(jobId, "INFO", "🔑 Tentativo auto-login WCA...");
  try {
    const { fetchWcaCredentials } = await import("@/lib/wcaCredentials");
    const creds = await fetchWcaCredentials();
    if (!creds) {
      await appendLog(jobId, "WARN", "⚠️ Credenziali WCA non configurate — vai in Impostazioni → Connessioni");
      return false;
    }

    const loginResult = await sendToExtension("autoLogin", {
      username: creds.username,
      password: creds.password,
    }, 45_000);

    if (loginResult?.success) {
      // Sync cookie after login
      await sendToExtension("syncCookie", {}, 10_000);
      // Verify session after login
      const verify = await sendToExtension("verifySession", {}, 15_000);
      if (verify?.success && verify?.authenticated) {
        await appendLog(jobId, "INFO", "✅ Auto-login riuscito — sessione WCA attiva");
        return true;
      }
    }

    await appendLog(jobId, "WARN", "❌ Auto-login fallito — prova login manuale su wcaworld.com");
    return false;
  } catch (err) {
    console.error("[SessionVerifier] Auto-login error:", err);
    return false;
  }
}

export async function verifyWcaSession(
  jobId: string,
  isAvailable: boolean,
  checkAvailable: () => Promise<boolean>,
): Promise<boolean> {
  // Step 1: Check extension availability
  const extOk = isAvailable || await checkAvailable();

  if (!extOk) {
    await appendLog(jobId, "WARN", "⚠️ Estensione Chrome non rilevata — controllo sessione server...");
    // DB fallback when no extension
    const dbOk = await checkDbSessionStatus();
    if (dbOk) {
      await appendLog(jobId, "INFO", "✅ Sessione WCA attiva (verificata lato server)");
      return true;
    }
    await appendLog(jobId, "WARN", "❌ Sessione WCA non attiva e estensione non disponibile");
    return false;
  }

  // Step 2: Verify session via extension (local cookie check)
  const result = await sendToExtension("verifySession");
  if (result?.success && result?.authenticated) {
    await appendLog(jobId, "INFO", "✅ Sessione WCA attiva");
    return true;
  }

  // Step 3: Auto-login attempt
  const loginOk = await attemptAutoLogin(jobId);
  if (loginOk) return true;

  // Step 4: Last resort — check DB
  const dbFallback = await checkDbSessionStatus();
  if (dbFallback) {
    await appendLog(jobId, "INFO", "✅ Sessione WCA attiva (fallback server)");
    return true;
  }

  await appendLog(jobId, "WARN", "❌ Sessione WCA non attivabile — login manuale richiesto");
  return false;
}
