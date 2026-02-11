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
      // Stop polling once detected
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    // Immediate check + periodic polling
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

    // Ping immediately
    doPing();

    // Then every 5s
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

        // Set timeout
        const timer = setTimeout(() => {
          pendingRef.current.delete(requestId);
          resolve({ success: false, error: "Timeout" });
        }, timeoutMs);

        // Register pending callback
        pendingRef.current.set(requestId, (response) => {
          clearTimeout(timer);
          resolve(response);
        });

        // Post message to content script
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

    // Try 3 times with 1s delay
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

  return {
    isAvailable,
    checkAvailable,
    extractContacts,
  };
}
