import { useState, useEffect, useCallback, useRef } from "react";

export interface FireScrapeSearchResult {
  url: string;
  title: string;
  snippet: string;
}

type FsResponse = {
  success: boolean;
  error?: string;
  version?: string;
  engine?: string;
  results?: FireScrapeSearchResult[];
  data?: {
    title?: string;
    description?: string;
    logoUrl?: string | null;
    markdown?: string;
    url?: string;
  };
};

export function useFireScrapeExtensionBridge() {
  const [isAvailable, setIsAvailable] = useState(false);
  const pendingRef = useRef<Map<string, (r: FsResponse) => void>>(new Map());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Listen for responses
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.source !== window) return;
      const d = event.data;
      if (!d || d.direction !== "from-extension-fs") return;

      if (d.action === "contentScriptReady") { setIsAvailable(true); return; }
      if (d.action === "extensionDead") { setIsAvailable(false); return; }
      if (d.action === "ping" && d.response?.success) { setIsAvailable(true); return; }
      if (d.action === "ping" && d.response?.error) { setIsAvailable(false); return; }

      if (d.requestId && pendingRef.current.has(d.requestId)) {
        const resolve = pendingRef.current.get(d.requestId)!;
        pendingRef.current.delete(d.requestId);
        resolve(d.response);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Polling
  useEffect(() => {
    const doPing = () => {
      window.postMessage({
        direction: "from-webapp-fs",
        action: "ping",
        requestId: `poll_fs_${Date.now()}`,
      }, window.location.origin);
    };
    doPing();
    pollRef.current = setInterval(doPing, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const sendMessage = useCallback(
    (action: string, payload?: Record<string, any>, timeoutMs = 30000): Promise<FsResponse> =>
      new Promise((resolve) => {
        const requestId = `fs_${action}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const timer = setTimeout(() => {
          pendingRef.current.delete(requestId);
          resolve({ success: false, error: "Timeout" });
        }, timeoutMs);
        pendingRef.current.set(requestId, (r) => { clearTimeout(timer); resolve(r); });
        window.postMessage({ direction: "from-webapp-fs", action, requestId, ...payload }, window.location.origin);
      }),
    []
  );

  const search = useCallback(
    (query: string, limit = 5) => sendMessage("search", { query, limit }, 20000),
    [sendMessage]
  );

  const scrape = useCallback(
    (url: string) => sendMessage("scrape", { url }, 20000),
    [sendMessage]
  );

  return { isAvailable, search, scrape };
}
