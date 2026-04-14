import { useState, useEffect, useCallback, useRef } from "react";
import { createLogger } from "@/lib/log";

const log = createLogger("useLinkedInExtensionBridge");

type LiExtensionResponse = {
  success: boolean;
  error?: string;
  version?: string;
  authenticated?: boolean;
  reason?: string;
  cookieLength?: number;
  cookieSynced?: boolean;
  profile?: {
    name?: string;
    headline?: string;
    location?: string;
    about?: string;
    photoUrl?: string;
    profileUrl?: string;
  };
};

export function useLinkedInExtensionBridge() {
  const [isAvailable, setIsAvailable] = useState(false);
  const pendingRef = useRef<Map<string, (response: LiExtensionResponse) => void>>(new Map());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const availableRef = useRef(false);
  const configSentRef = useRef(false);

  useEffect(() => { availableRef.current = isAvailable; }, [isAvailable]);

  // Send Supabase config to extension when it becomes available
  const sendConfig = useCallback(() => {
    if (configSentRef.current) return;
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return;
    configSentRef.current = true;
    log.debug("→ sending setConfig to extension");
    window.postMessage({
      direction: "from-webapp-li",
      action: "setConfig",
      requestId: `li_setConfig_${Date.now()}`,
      supabaseUrl: url,
      supabaseAnonKey: key,
    }, window.location.origin);
  }, []);

  // Listen for responses from the content script
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.source !== window) return;
      const data = event.data;
      if (!data || data.direction !== "from-extension-li") return;

      if (data.action === "contentScriptReady") { setIsAvailable(true); sendConfig(); return; }
      if (data.action === "extensionDead") { setIsAvailable(false); configSentRef.current = false; return; }
      if (data.action === "ping" && data.response?.success) { setIsAvailable(true); sendConfig(); return; }
      if (data.action === "ping" && data.response?.error) { setIsAvailable(false); configSentRef.current = false; return; }

      if (data.requestId && pendingRef.current.has(data.requestId)) {
        const resolve = pendingRef.current.get(data.requestId)!;
        pendingRef.current.delete(data.requestId);
        resolve(data.response);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Continuous polling
  useEffect(() => {
    const doPing = () => {
      window.postMessage({
        direction: "from-webapp-li",
        action: "ping",
        requestId: `poll_li_${Date.now()}`,
      }, window.location.origin);
    };

    doPing();
    pollRef.current = setInterval(doPing, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const sendMessage = useCallback(
    (action: string, payload?: Record<string, unknown>, timeoutMs = 60000): Promise<LiExtensionResponse> => {
      return new Promise((resolve) => {
        const requestId = `li_${action}_${crypto.randomUUID()}`;

        log.debug("→ request", { action, requestId, payloadKeys: payload ? Object.keys(payload) : [] });

        const timer = setTimeout(() => {
          pendingRef.current.delete(requestId);
          log.warn("timeout", { action, timeoutMs, requestId });
          resolve({ success: false, error: "Timeout" });
        }, timeoutMs);

        pendingRef.current.set(requestId, (response) => {
          clearTimeout(timer);
          log.debug("← response", { action, requestId, success: response.success, error: response.error });
          resolve(response);
        });

        window.postMessage({ direction: "from-webapp-li", action, requestId, ...payload }, window.location.origin);
      });
    },
    []
  );

  const verifySession = useCallback(
    () => sendMessage("verifySession", {}, 30000),
    [sendMessage]
  );

  const syncCookie = useCallback(
    () => sendMessage("syncCookie", {}, 15000),
    [sendMessage]
  );

  const autoLogin = useCallback(
    () => sendMessage("autoLogin", {}, 60000),
    [sendMessage]
  );

  const extractProfile = useCallback(
    (url: string) => sendMessage("extractProfile", { url }, 30000),
    [sendMessage]
  );

  const sendDirectMessage = useCallback(
    (profileUrl: string, message: string) =>
      sendMessage("sendMessage", { url: profileUrl, message }, 60000),
    [sendMessage]
  );

  const sendConnectionRequest = useCallback(
    (profileUrl: string, note?: string) =>
      sendMessage("sendConnectionRequest", { url: profileUrl, note: note || "" }, 60000),
    [sendMessage]
  );

  const searchProfile = useCallback(
    (query: string) => sendMessage("searchProfile", { query }, 30000),
    [sendMessage]
  );

  const learnDom = useCallback(
    (pageType?: string) => sendMessage("learnDom", { pageType: pageType || "profile" }, 60000),
    [sendMessage]
  );

  /**
   * Centralized auth guard — checks extension + real session.
   * Caches result for `cacheTtlMs` to avoid spamming verifySession.
   */
  const lastAuthCheck = useRef<{ ok: boolean; ts: number }>({ ok: false, ts: 0 });

  const ensureAuthenticated = useCallback(
    async (cacheTtlMs = 30000): Promise<{ ok: boolean; reason: string }> => {
      if (!availableRef.current) {
        return { ok: false, reason: "extension_not_available" };
      }
      // Use cache if fresh
      const now = Date.now();
      if (now - lastAuthCheck.current.ts < cacheTtlMs) {
        return { ok: lastAuthCheck.current.ok, reason: lastAuthCheck.current.ok ? "cached_ok" : "cached_not_authenticated" };
      }
      try {
        const r = await sendMessage("verifySession", {}, 30000);
        const ok = r.success === true && r.authenticated === true;
        lastAuthCheck.current = { ok, ts: Date.now() };
        return { ok, reason: ok ? "authenticated" : r.reason || "not_authenticated" };
      } catch (e) {
        log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) });
        lastAuthCheck.current = { ok: false, ts: Date.now() };
        return { ok: false, reason: "verify_error" };
      }
    },
    [sendMessage]
  );

  return { isAvailable, verifySession, syncCookie, autoLogin, extractProfile, sendDirectMessage, sendConnectionRequest, searchProfile, learnDom, ensureAuthenticated };
}
