import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";

// ── Global serial queue for extractContacts — safety net against concurrent extractions ──
const EXTRACT_LOCK_KEY = '__extractContactsLock__';

type ExtractLock = {
  busy: boolean;
  queue: Array<{ resolve: (v: any) => void; fn: () => Promise<any> }>;
};

function getExtractLock(): ExtractLock {
  if (!(window as any)[EXTRACT_LOCK_KEY]) {
    (window as any)[EXTRACT_LOCK_KEY] = { busy: false, queue: [] };
  }
  return (window as any)[EXTRACT_LOCK_KEY];
}

async function enqueueExtraction<T>(fn: () => Promise<T>): Promise<T> {
  const lock = getExtractLock();
  return new Promise<T>((resolve) => {
    const run = async () => {
      lock.busy = true;
      try {
        const result = await fn();
        resolve(result);
      } catch (err) {
        resolve({ success: false, error: String(err) } as any);
      } finally {
        lock.busy = false;
        const next = lock.queue.shift();
        if (next) next.fn().then(next.resolve);
      }
    };
    if (!lock.busy) {
      run();
    } else {
      console.warn("[ExtensionBridge] extractContacts queued — another extraction in progress");
      lock.queue.push({ resolve, fn: run as any });
    }
  });
}

type ExtensionProfile = {
  address?: string;
  phone?: string;
  fax?: string;
  mobile?: string;
  emergencyPhone?: string;
  email?: string;
  website?: string;
  memberSince?: string;
  membershipExpires?: string;
  officeType?: string;
  description?: string;
  networks?: Array<{ name: string; id?: string; expires?: string | null }>;
  services?: string[];
  certifications?: string[];
  branchCities?: string[];
};

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
  pageLoaded?: boolean;
  profile?: ExtensionProfile;
  profileHtml?: string;
};

/**
 * Hook for communicating with the WCA Chrome Extension via content script bridge.
 * Uses window.postMessage so no Extension ID is needed.
 * Continuous polling to reliably detect the extension even if loaded after the page.
 */
export function useExtensionBridge() {
  const [isAvailable, setIsAvailable] = useState(false);
  const pendingRef = useRef<Map<string, (response: ExtensionResponse) => void>>(new Map());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const availableRef = useRef(false);

  // Keep ref in sync with state
  useEffect(() => {
    availableRef.current = isAvailable;
  }, [isAvailable]);

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

  // CONTINUOUS polling every 3s with watchdog
  const consecutiveFailsRef = useRef(0);

  useEffect(() => {
    const doPing = () => {
      const id = `poll_${Date.now()}`;
      const timer = setTimeout(() => {
        // No response within 5s → extension unreachable
        consecutiveFailsRef.current++;
        if (consecutiveFailsRef.current >= 2 && availableRef.current) {
          setIsAvailable(false);
          toast.warning("Estensione browser non risponde", { id: "ext-watchdog", duration: 5000 });
        }
      }, 5000);

      const handler = (e: MessageEvent) => {
        if (e.data?.direction === "from-extension" && e.data?.requestId === id) {
          clearTimeout(timer);
          window.removeEventListener("message", handler);
          consecutiveFailsRef.current = 0;
          if (e.data?.response?.success) setIsAvailable(true);
        }
      };
      window.addEventListener("message", handler);

      const origin = window.location.origin;
      window.postMessage(
        { direction: "from-webapp", action: "ping", requestId: id },
        origin || "*"
      );
    };

    doPing();
    pollRef.current = setInterval(doPing, 3000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, []);

  // Send a message to the extension and wait for response (with nonce anti-spoof)
  const sendMessage = useCallback(
    (action: string, payload?: Record<string, any>, timeoutMs = 60000): Promise<ExtensionResponse> => {
      return new Promise((resolve) => {
        const requestId = `${action}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const nonce = crypto.randomUUID();

        const timer = setTimeout(() => {
          pendingRef.current.delete(requestId);
          resolve({ success: false, error: "Timeout" });
        }, timeoutMs);

        pendingRef.current.set(requestId, (response) => {
          clearTimeout(timer);
          resolve(response);
        });

        const origin = window.location.origin;
        window.postMessage(
          {
            direction: "from-webapp",
            action,
            requestId,
            nonce,
            ...payload,
          },
          origin || "*"
        );
      });
    },
    []
  );

  // Check if extension is available (with retries)
  const checkAvailable = useCallback(async (): Promise<boolean> => {
    if (availableRef.current) return true;

    for (let attempt = 0; attempt < 5; attempt++) {
      const response = await sendMessage("ping", {}, 3000);
      if (response.success === true) {
        setIsAvailable(true);
        return true;
      }
      if (attempt < 4) await new Promise((r) => setTimeout(r, 1000));
    }
    return false;
  }, [sendMessage]);

  // Wait for extension to become available
  const waitForExtension = useCallback(
    (maxWaitMs = 10000): Promise<boolean> => {
      return new Promise((resolve) => {
        if (availableRef.current) {
          resolve(true);
          return;
        }

        const start = Date.now();
        const interval = setInterval(() => {
          if (availableRef.current) {
            clearInterval(interval);
            resolve(true);
            return;
          }
          if (Date.now() - start >= maxWaitMs) {
            clearInterval(interval);
            resolve(false);
          }
        }, 500);
      });
    },
    []
  );

  // Extract contacts for a WCA ID — serialized via global queue
  const extractContacts = useCallback(
    async (wcaId: number): Promise<ExtensionResponse> => {
      return enqueueExtraction(() => sendMessage("extractContacts", { wcaId }, 90000));
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
    waitForExtension,
    extractContacts,
    verifySession,
    syncCookie,
  };
}
