import { useState, useEffect, useCallback, useRef } from "react";

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

  useEffect(() => { availableRef.current = isAvailable; }, [isAvailable]);

  // Listen for responses from the content script
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.source !== window) return;
      const data = event.data;
      if (!data || data.direction !== "from-extension-li") return;

      if (data.action === "contentScriptReady") { setIsAvailable(true); return; }
      if (data.action === "ping" && data.response?.success) { setIsAvailable(true); return; }

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
      }, "*");
    };

    doPing();
    pollRef.current = setInterval(doPing, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const sendMessage = useCallback(
    (action: string, payload?: Record<string, any>, timeoutMs = 60000): Promise<LiExtensionResponse> => {
      return new Promise((resolve) => {
        const requestId = `li_${action}_${Date.now()}_${Math.random().toString(36).slice(2)}`;

        const timer = setTimeout(() => {
          pendingRef.current.delete(requestId);
          resolve({ success: false, error: "Timeout" });
        }, timeoutMs);

        pendingRef.current.set(requestId, (response) => {
          clearTimeout(timer);
          resolve(response);
        });

        window.postMessage({ direction: "from-webapp-li", action, requestId, ...payload }, "*");
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

  return { isAvailable, verifySession, syncCookie, autoLogin, extractProfile, sendDirectMessage };
}
