import { useState, useEffect, useCallback, useRef } from "react";

type ExtensionResponse = {
  success: boolean;
  contacts?: Array<{
    name?: string;
    title?: string;
    email?: string;
    phone?: string;
    mobile?: string;
  }>;
  companyName?: string;
  wcaId?: number;
  error?: string;
  version?: string;
  authenticated?: boolean;
  reason?: string;
  cookieLength?: number;
};

/**
 * Hook for communicating with the WCA Chrome Extension via content script bridge.
 * Uses window.postMessage so no Extension ID is needed.
 * Includes automatic polling to reliably detect the extension.
 */
export function useExtensionBridge() {
  const [isAvailable, setIsAvailable] = useState(false);
  const pendingRef = useRef<Map<string, (response: ExtensionResponse) => void>>(new Map());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Listen for responses from the content script
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.source !== window) return;
      const data = event.data;
      if (!data || data.direction !== "from-extension") return;

      // Content script loaded
      if (data.action === "contentScriptReady") {
        setIsAvailable(true);
        return;
      }

      // Any successful ping response means extension is alive
      if (data.action === "ping" && data.response?.success) {
        setIsAvailable(true);
        return;
      }

      // Response to a request
      if (data.requestId && pendingRef.current.has(data.requestId)) {
        const resolve = pendingRef.current.get(data.requestId)!;
        pendingRef.current.delete(data.requestId);
        resolve(data.response);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Auto-poll every 5s until extension is detected
  useEffect(() => {
    if (isAvailable) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    const doPing = () => {
      window.postMessage(
        {
          direction: "from-webapp",
          action: "ping",
          requestId: `poll_${Date.now()}`,
        },
        "*"
      );
    };

    doPing();
    pollRef.current = setInterval(doPing, 5000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [isAvailable]);

  // Send a message to the extension and wait for response
  const sendMessage = useCallback(
    (action: string, payload?: Record<string, any>, timeoutMs = 60000): Promise<ExtensionResponse> => {
      return new Promise((resolve) => {
        const requestId = `${action}_${Date.now()}_${Math.random().toString(36).slice(2)}`;

        const timer = setTimeout(() => {
          pendingRef.current.delete(requestId);
          resolve({ success: false, error: "Timeout" });
        }, timeoutMs);

        pendingRef.current.set(requestId, (response) => {
          clearTimeout(timer);
          resolve(response);
        });

        window.postMessage(
          {
            direction: "from-webapp",
            action,
            requestId,
            ...payload,
          },
          "*"
        );
      });
    },
    []
  );

  // Check if extension is available (with retries)
  const checkAvailable = useCallback(async (): Promise<boolean> => {
    if (isAvailable) return true;

    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await sendMessage("ping", {}, 2000);
      if (response.success === true) {
        setIsAvailable(true);
        return true;
      }
      if (attempt < 2) await new Promise((r) => setTimeout(r, 1000));
    }
    return false;
  }, [isAvailable, sendMessage]);

  // Extract contacts for a WCA ID
  const extractContacts = useCallback(
    async (wcaId: number): Promise<ExtensionResponse> => {
      return sendMessage("extractContacts", { wcaId }, 60000);
    },
    [sendMessage]
  );

  // Verify WCA session is still authenticated
  const verifySession = useCallback(
    async (): Promise<ExtensionResponse> => {
      return sendMessage("verifySession", {}, 30000);
    },
    [sendMessage]
  );

  // Sync WCA cookies to the database
  const syncCookie = useCallback(
    async (): Promise<ExtensionResponse> => {
      return sendMessage("syncCookie", {}, 15000);
    },
    [sendMessage]
  );

  return {
    isAvailable,
    checkAvailable,
    extractContacts,
    verifySession,
    syncCookie,
  };
}
