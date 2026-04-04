/**
 * LinkedIn Messaging Bridge
 * Communicates with the LinkedIn extension to read/send messages.
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
    const requestId = `li_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const timer = setTimeout(() => {
      window.removeEventListener("message", handler);
      resolve({ success: false, error: "timeout" });
    }, timeoutMs);

    const handler = (e: MessageEvent) => {
      if (e.data?.direction === "from-extension" && e.data?.source === "li-content-bridge" && e.data?.requestId === requestId) {
        clearTimeout(timer);
        window.removeEventListener("message", handler);
        resolve(e.data.response || { success: false, error: "empty response" });
      }
    };
    window.addEventListener("message", handler);
    window.postMessage({
      direction: "from-webapp",
      source: "webapp",
      target: "linkedin",
      action,
      requestId,
      ...data,
    }, window.location.origin || "*");
  });
}

export function useLinkedInMessagingBridge() {
  const [isAvailable, setIsAvailable] = useState(false);
  const heartbeatRef = useRef<ReturnType<typeof setInterval>>();

  // Heartbeat to check extension availability
  useEffect(() => {
    const check = async () => {
      const res = await sendToExtension("ping", {}, 3000);
      setIsAvailable(res.success === true);
    };
    check();
    heartbeatRef.current = setInterval(check, 10000);
    return () => clearInterval(heartbeatRef.current);
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
