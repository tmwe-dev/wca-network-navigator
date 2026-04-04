/**
 * LinkedIn Messaging Bridge
 * Uses the same protocol as useLinkedInExtensionBridge (from-webapp-li / from-extension-li).
 * Ultra-conservative: long timeouts, no aggressive polling.
 */
import { useState, useCallback, useEffect, useRef } from "react";

type BridgeResponse = {
  success: boolean;
  error?: string;
  threads?: Array<{ name: string; lastMessage: string; unread: boolean; threadUrl: string }>;
  messages?: Array<{ text: string; sender: string; timestamp: string; direction: string }>;
  [key: string]: any;
};

function sendToExtension(action: string, data: Record<string, any> = {}, timeoutMs = 15000): Promise<BridgeResponse> {
  return new Promise((resolve) => {
    const requestId = `li_msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const timer = setTimeout(() => {
      window.removeEventListener("message", handler);
      resolve({ success: false, error: "timeout" });
    }, timeoutMs);

    const handler = (e: MessageEvent) => {
      if (e.source !== window) return;
      const d = e.data;
      if (!d || d.direction !== "from-extension-li") return;
      if (d.requestId !== requestId) return;
      clearTimeout(timer);
      window.removeEventListener("message", handler);
      resolve(d.response || { success: false, error: "empty response" });
    };
    window.addEventListener("message", handler);
    window.postMessage({
      direction: "from-webapp-li",
      action,
      requestId,
      ...data,
    }, window.location.origin);
  });
}

export function useLinkedInMessagingBridge() {
  const [isAvailable, setIsAvailable] = useState(false);
  const heartbeatRef = useRef<ReturnType<typeof setInterval>>();

  // Heartbeat — check every 15s (conservative for LinkedIn)
  useEffect(() => {
    const check = async () => {
      const res = await sendToExtension("ping", {}, 4000);
      setIsAvailable(res.success === true);
    };
    check();
    heartbeatRef.current = setInterval(check, 15000);
    return () => clearInterval(heartbeatRef.current);
  }, []);

  // Also listen for spontaneous readiness signals
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.source !== window) return;
      const d = e.data;
      if (d?.direction !== "from-extension-li") return;
      if (d.action === "contentScriptReady") setIsAvailable(true);
      if (d.action === "extensionDead") setIsAvailable(false);
      if (d.action === "ping" && d.response?.success) setIsAvailable(true);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const readInbox = useCallback(async (): Promise<BridgeResponse> => {
    return sendToExtension("readLinkedInInbox", {}, 30000);
  }, []);

  const readThread = useCallback(async (threadUrl: string): Promise<BridgeResponse> => {
    return sendToExtension("readLinkedInThread", { threadUrl }, 20000);
  }, []);

  const sendMessage = useCallback(async (profileUrl: string, text: string): Promise<BridgeResponse> => {
    return sendToExtension("sendMessage", { url: profileUrl, message: text }, 20000);
  }, []);

  return { isAvailable, readInbox, readThread, sendMessage };
}
