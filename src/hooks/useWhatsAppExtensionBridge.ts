import { useState, useEffect, useCallback, useRef } from "react";

type WaExtensionResponse = {
  success: boolean;
  error?: string;
  version?: string;
  authenticated?: boolean;
  reason?: string;
};

export function useWhatsAppExtensionBridge() {
  const [isAvailable, setIsAvailable] = useState(false);
  const pendingRef = useRef<Map<string, (response: WaExtensionResponse) => void>>(new Map());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.source !== window) return;
      const data = event.data;
      if (!data || data.direction !== "from-extension-wa") return;

      if (data.action === "contentScriptReady") { setIsAvailable(true); return; }
      if (data.action === "extensionDead") { setIsAvailable(false); return; }
      if (data.action === "ping" && data.response?.success) { setIsAvailable(true); return; }
      if (data.action === "ping" && data.response?.error) { setIsAvailable(false); return; }

      if (data.requestId && pendingRef.current.has(data.requestId)) {
        const resolve = pendingRef.current.get(data.requestId)!;
        pendingRef.current.delete(data.requestId);
        resolve(data.response);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    const doPing = () => {
      window.postMessage({
        direction: "from-webapp-wa",
        action: "ping",
        requestId: `poll_wa_${Date.now()}`,
      }, "*");
    };

    doPing();
    pollRef.current = setInterval(doPing, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const sendMsg = useCallback(
    (action: string, payload?: Record<string, any>, timeoutMs = 60000): Promise<WaExtensionResponse> => {
      return new Promise((resolve) => {
        const requestId = `wa_${action}_${Date.now()}_${Math.random().toString(36).slice(2)}`;

        const timer = setTimeout(() => {
          pendingRef.current.delete(requestId);
          resolve({ success: false, error: "Timeout" });
        }, timeoutMs);

        pendingRef.current.set(requestId, (response) => {
          clearTimeout(timer);
          resolve(response);
        });

        window.postMessage({ direction: "from-webapp-wa", action, requestId, ...payload }, window.location.origin);
      });
    },
    []
  );

  const verifySession = useCallback(
    () => sendMsg("verifySession", {}, 30000),
    [sendMsg]
  );

  const sendWhatsApp = useCallback(
    (phone: string, text: string) => sendMsg("sendWhatsApp", { phone, text }, 60000),
    [sendMsg]
  );

  return { isAvailable, verifySession, sendWhatsApp };
}
