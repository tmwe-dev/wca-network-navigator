/**
 * extensionBridge — Shared postMessage bridge for extension communication
 */

export function sendToExtension(
  direction: string,
  responseDirection: string,
  action: string,
  payload: Record<string, unknown> = {},
  timeoutMs = 30000
): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const requestId = `test_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const timer = setTimeout(() => {
      window.removeEventListener("message", handler);
      resolve({ success: false, error: `Timeout ${timeoutMs / 1000}s` });
    }, timeoutMs);

    function handler(e: MessageEvent) {
      if (e.source !== window) return;
      if (e.data?.direction !== responseDirection) return;
      if (e.data?.requestId !== requestId) return;
      clearTimeout(timer);
      window.removeEventListener("message", handler);
      resolve(e.data.response || e.data);
    }

    window.addEventListener("message", handler);
    window.postMessage({ direction, action, requestId, ...payload }, window.location.origin);
  });
}

export const waMsg = (action: string, payload: Record<string, unknown> = {}, timeout = 60000) =>
  sendToExtension("from-webapp-wa", "from-extension-wa", action, payload, timeout);

export const fsMsg = (action: string, payload: Record<string, unknown> = {}, timeout = 30000) =>
  sendToExtension("from-webapp-fs", "from-extension-fs", action, payload, timeout);

let liConfigSent = false;
function ensureLiConfig() {
  if (liConfigSent) return;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return;
  liConfigSent = true;
  window.postMessage({
    direction: "from-webapp-li",
    action: "setConfig",
    requestId: `li_setConfig_${Date.now()}`,
    supabaseUrl: url,
    supabaseAnonKey: key,
  }, window.location.origin);
}

export const liMsg = (action: string, payload: Record<string, unknown> = {}, timeout = 30000) => {
  ensureLiConfig();
  return sendToExtension("from-webapp-li", "from-extension-li", action, payload, timeout);
};
