import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { createLogger } from "@/lib/log";

const log = createLogger("useWhatsAppExtensionBridge");
let lastTabVisibleToastAt = 0;

type WaExtensionResponse = {
  success: boolean;
  error?: string;
  version?: string;
  authenticated?: boolean;
  reason?: string;
  method?: string;
  messages?: Array<Record<string, unknown>>;
  scanned?: number;
};

export function useWhatsAppExtensionBridge() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const pendingRef = useRef<Map<string, (response: WaExtensionResponse) => void>>(new Map());
  const authCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const configSentRef = useRef(false);
  const sidebarChangedCbRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.source !== window) return;
      const data = event.data;
      if (!data || data.direction !== "from-extension-wa") return;

      if (data.action === "contentScriptReady") { setIsAvailable(true); return; }
      if (data.action === "extensionDead") { setIsAvailable(false); return; }
      if (data.action === "ping" && data.response?.success) { setIsAvailable(true); return; }
      if (data.action === "ping" && data.response?.error) { setIsAvailable(false); return; }

      // Push event from MutationObserver
      if (data.action === "sidebarChanged") {
        sidebarChangedCbRef.current?.();
        return;
      }

      if (data.requestId && pendingRef.current.has(data.requestId)) {
        const resolve = pendingRef.current.get(data.requestId)!;
        pendingRef.current.delete(data.requestId);
        const resp = data.response as (WaExtensionResponse & { errorCode?: string }) | undefined;
        if (resp && resp.errorCode === "TAB_NOT_VISIBLE") {
          const now = Date.now();
          if (now - lastTabVisibleToastAt > 3000) {
            lastTabVisibleToastAt = now;
            toast.error("Apri WhatsApp Web nel browser", {
              description: "La tab deve essere visibile per leggere i messaggi.",
            });
          }
        }
        resolve(data.response);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Send Supabase config to extension so it can call AI edge function
  const sendConfig = useCallback(async () => {
    if (configSentRef.current) return;
    
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    
    if (!supabaseUrl || !anonKey) return;

    // Get auth token if available
    let authToken = "";
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase.auth.getSession();
      authToken = data.session?.access_token || "";
    } catch (err) { console.warn("[WA Bridge] Failed to get auth session:", err); }

    const requestId = `wa_setConfig_${Date.now()}`;
    window.postMessage({
      direction: "from-webapp-wa",
      action: "setConfig",
      requestId,
      supabaseUrl,
      anonKey,
      authToken,
    }, window.location.origin);
    
    configSentRef.current = true;
  }, []);

  useEffect(() => {
    const doPing = () => {
      window.postMessage({
        direction: "from-webapp-wa",
        action: "ping",
        requestId: `poll_wa_${Date.now()}`,
      }, window.location.origin);
    };

    doPing();
    pollRef.current = setInterval(doPing, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // Send config when extension becomes available
  useEffect(() => {
    if (isAvailable && !configSentRef.current) {
      sendConfig();
    }
  }, [isAvailable, sendConfig]);

  // Session authentication heartbeat every 30s
  useEffect(() => {
    if (authCheckRef.current) clearInterval(authCheckRef.current);
    if (!isAvailable) {
      setIsAuthenticated(false);
      return;
    }

    const checkAuth = async () => {
      try {
        const requestId = `wa_verifySession_${crypto.randomUUID()}`;
        const result = await new Promise<WaExtensionResponse>((resolve) => {
          const timer = setTimeout(() => {
            pendingRef.current.delete(requestId);
            resolve({ success: false, error: "Timeout" });
          }, 10000);
          pendingRef.current.set(requestId, (response) => {
            clearTimeout(timer);
            resolve(response);
          });
          window.postMessage({ direction: "from-webapp-wa", action: "verifySession", requestId }, window.location.origin);
        });
        setIsAuthenticated(result.success === true && result.authenticated === true);
      } catch (e) {
        log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) });
        setIsAuthenticated(false);
      }
    };

    // Check immediately, then every 30s
    checkAuth();
    authCheckRef.current = setInterval(checkAuth, 30000);
    return () => { if (authCheckRef.current) clearInterval(authCheckRef.current); };
  }, [isAvailable]);

  const sendMsg = useCallback(
    (action: string, payload?: Record<string, unknown>, timeoutMs = 60000): Promise<WaExtensionResponse> => {
      return new Promise((resolve) => {
        const requestId = `wa_${action}_${crypto.randomUUID()}`;

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

  const readUnread = useCallback(
    () => sendMsg("readUnread", {}, 45000),
    [sendMsg]
  );

  const readThread = useCallback(
    (contact: string, maxMessages = 50) =>
      sendMsg("readThread", { contact, maxMessages }, 60000),
    [sendMsg]
  );

  // DOM Learning: ask AI to map WhatsApp Web selectors, cache result
  const learnDom = useCallback(
    () => sendMsg("learnDom", {}, 90000),
    [sendMsg]
  );

  const backfillChat = useCallback(
    (contact: string, lastKnownText: string, maxScrolls = 30) =>
      sendMsg("backfillChat", { contact, lastKnownText, maxScrolls }, 120000),
    [sendMsg]
  );

  const onSidebarChanged = useCallback((cb: () => void) => {
    sidebarChangedCbRef.current = cb;
  }, []);

  return { isAvailable, isAuthenticated, verifySession, sendWhatsApp, readUnread, readThread, learnDom, backfillChat, onSidebarChanged };
}
