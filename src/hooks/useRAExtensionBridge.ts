import { useState, useEffect, useCallback, useRef } from "react";

export interface RAScrapingStatus {
  active: boolean;
  total: number;
  processed: number;
  saved: number;
  errors: number;
  currentCompany: string;
  log: Array<{ time: string; msg: string }>;
}

type RAResponse = {
  success: boolean;
  error?: string;
  active?: boolean;
  total?: number;
  processed?: number;
  saved?: number;
  errors?: number;
  currentCompany?: string;
  log?: Array<{ time: string; msg: string }>;
  data?: Record<string, unknown>;
  results?: Array<Record<string, unknown>>;
  version?: string;
};

export function useRAExtensionBridge() {
  const [isAvailable, setIsAvailable] = useState(false);
  const pendingRef = useRef<Map<string, (response: RAResponse) => void>>(new Map());
  const availableRef = useRef(false);

  useEffect(() => { availableRef.current = isAvailable; }, [isAvailable]);

  // Listen for responses from the RA content script
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.source !== window) return;
      const data = event.data;
      if (!data || data.direction !== "from-extension-ra") return;

      if (data.action === "contentScriptReady") {
        setIsAvailable(true);
        return;
      }

      if (data.action === "ping" && data.response?.success) {
        setIsAvailable(true);
        return;
      }

      if (data.requestId && pendingRef.current.has(data.requestId)) {
        const resolve = pendingRef.current.get(data.requestId)!;
        pendingRef.current.delete(data.requestId);
        resolve(data.response || { success: false, error: "No response" });
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Poll for RA extension every 5s
  useEffect(() => {
    const doPing = () => {
      window.postMessage({ direction: "from-webapp-ra", action: "ping", requestId: `ra_poll_${Date.now()}` }, window.location.origin);
    };
    doPing();
    const interval = setInterval(doPing, 5000);
    return () => clearInterval(interval);
  }, []);

  const sendMessage = useCallback(
    (action: string, payload?: Record<string, unknown>, timeoutMs = 600000): Promise<RAResponse> => {
      return new Promise((resolve) => {
        const requestId = `ra_${action}_${crypto.randomUUID()}`;

        const timer = setTimeout(() => {
          pendingRef.current.delete(requestId);
          resolve({ success: false, error: "Timeout" });
        }, timeoutMs);

        pendingRef.current.set(requestId, (response) => {
          clearTimeout(timer);
          resolve(response);
        });

        window.postMessage({ direction: "from-webapp-ra", action, requestId, ...payload }, window.location.origin);
      });
    },
    []
  );

  const scrapeByAteco = useCallback(
    (params: { atecoCode?: string; atecoCodes?: string[]; region?: string; regions?: string[]; province?: string; provinces?: string[]; minFatturato?: number; maxFatturato?: number; delaySeconds?: number; batchSize?: number }) => {
      return sendMessage("scrapeByAteco", { params }, 1800000); // 30min timeout
    },
    [sendMessage]
  );

  /** Phase 1: Search only — returns list of companies without scraping profiles */
  const searchOnly = useCallback(
    (params: { atecoCodes?: string[]; regions?: string[]; provinces?: string[]; filters?: any; delaySeconds?: number }) => { // eslint-disable-line @typescript-eslint/no-explicit-any -- Dynamic filter object shape
      return sendMessage("searchOnly", { params }, 600000); // 10min timeout
    },
    [sendMessage]
  );

  /** Phase 2: Scrape specific selected items */
  const scrapeSelected = useCallback(
    (params: { items: Array<{ name: string; url: string }>; delaySeconds?: number; batchSize?: number }) => {
      return sendMessage("scrapeSelected", { params }, 1800000); // 30min timeout
    },
    [sendMessage]
  );

  const scrapeCompany = useCallback(
    (url: string) => sendMessage("scrapeCompany", { url }, 60000),
    [sendMessage]
  );

  const getScrapingStatus = useCallback(
    (): Promise<RAResponse> => sendMessage("getScrapingStatus", {}, 5000),
    [sendMessage]
  );

  const stopScraping = useCallback(
    () => sendMessage("stopScraping", {}, 5000),
    [sendMessage]
  );

  const syncCookies = useCallback(
    () => sendMessage("syncCookies", {}, 15000),
    [sendMessage]
  );

  const autoLogin = useCallback(
    () => sendMessage("autoLogin", {}, 15000),
    [sendMessage]
  );

  return {
    isAvailable,
    scrapeByAteco,
    searchOnly,
    scrapeSelected,
    scrapeCompany,
    getScrapingStatus,
    stopScraping,
    syncCookies,
    autoLogin,
  };
}
