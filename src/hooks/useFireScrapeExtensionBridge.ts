import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Response from FireScrape extension — normalized from native responses.
 */
export type FsResponse<T = any> = {
  success: boolean;
  error?: string;
  version?: string;
  engine?: string;
  _fromCache?: boolean;
} & T;

export interface FsScrapeResult {
  markdown: string;
  metadata: {
    title: string;
    url: string;
    description: string;
    author: string;
    date: string;
    lang: string;
  };
  stats: { chars: number; words: number; readingTime: string };
}

export interface FsExtractResult {
  data: Record<string, unknown>;
  url: string;
}

export function useFireScrapeExtensionBridge() {
  const [isAvailable, setIsAvailable] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- extension bridge generic response
  const pendingRef = useRef<Map<string, (r: any) => void>>(new Map());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Listen for responses from the webapp-bridge.js content script
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

  /** Send a message to FireScrape background via the webapp-bridge content script */
  const sendMessage = useCallback(
    <T = any>(action: string, payload?: Record<string, unknown>, timeoutMs = 30000): Promise<FsResponse<T>> =>
      new Promise((resolve) => {
        const requestId = `fs_${action}_${crypto.randomUUID()}`;
        const timer = setTimeout(() => {
          pendingRef.current.delete(requestId);
          resolve({ success: false, error: "Timeout" } as FsResponse<T>);
        }, timeoutMs);
        pendingRef.current.set(requestId, (r) => { clearTimeout(timer); resolve(r); });
        window.postMessage({ direction: "from-webapp-fs", action, requestId, ...payload }, window.location.origin);
      }),
    []
  );

  // ── FireScrape native actions ──

  /** Scrape the active tab — returns markdown + metadata */
  const scrape = useCallback(
    (skipCache = false) => sendMessage<FsScrapeResult>("scrape", { skipCache }, 20000),
    [sendMessage]
  );

  /** Navigate to a URL in a background tab and scrape it via agent sequence */
  const scrapeUrl = useCallback(
    async (url: string): Promise<FsResponse<FsScrapeResult>> => {
      // Use agent-sequence: navigate → wait → scrape
      const navResult = await sendMessage("agent-action", {
        step: { action: "navigate", url }
      }, 20000);
      if (!navResult.success) return navResult as FsResponse<FsScrapeResult>;
      // Wait for page load then scrape
      await new Promise(r => setTimeout(r, 2000));
      return scrape(true);
    },
    [sendMessage, scrape]
  );

  /** Extract structured data using CSS/XPath selectors */
  const extract = useCallback(
    (schema: Record<string, string>) => sendMessage<FsExtractResult>("extract", { schema }, 15000),
    [sendMessage]
  );

  /** Run an agent action (click, type, navigate, scroll, wait) */
  const agentAction = useCallback(
    (step: { action: string; [key: string]: unknown }) =>
      sendMessage("agent-action", { step }, 30000),
    [sendMessage]
  );

  /** Run a multi-step agent sequence */
  const agentSequence = useCallback(
    (steps: Array<{ action: string; [key: string]: unknown }>) =>
      sendMessage("agent-sequence", { steps }, 60000),
    [sendMessage]
  );

  /** Take a snapshot of the current page DOM */
  const agentSnapshot = useCallback(
    () => sendMessage("agent-snapshot", {}, 10000),
    [sendMessage]
  );

  /** AI brain analysis */
  const brainAnalyze = useCallback(
    (topic: string) => sendMessage("brain-analyze", { topic }, 30000),
    [sendMessage]
  );

  /** AI brain think */
  const brainThink = useCallback(
    (prompt: string) => sendMessage("brain-think", { prompt }, 30000),
    [sendMessage]
  );

  /** Get cache stats */
  const cacheStats = useCallback(
    () => sendMessage("cache-stats", {}, 5000),
    [sendMessage]
  );

  /** Get rate limiter stats */
  const rateStats = useCallback(
    () => sendMessage("rate-stats", {}, 5000),
    [sendMessage]
  );

  /** Start relay (Claude bridge) */
  const relayStart = useCallback(
    () => sendMessage("relay-start", {}, 10000),
    [sendMessage]
  );

  /** Stop relay */
  const relayStop = useCallback(
    () => sendMessage("relay-stop", {}, 10000),
    [sendMessage]
  );

  /** Relay status */
  const relayStatus = useCallback(
    () => sendMessage("relay-status", {}, 5000),
    [sendMessage]
  );

  /** Google Search via background tab */
  const googleSearch = useCallback(
    (query: string, limit = 5, skipCache = false) =>
      sendMessage<{ data: Array<{ url: string; title: string; description: string }>; query: string; count: number }>(
        "google-search", { query, limit, skipCache }, 30000
      ),
    [sendMessage]
  );

  return {
    isAvailable,
    sendMessage,
    // Scraping
    scrape,
    scrapeUrl,
    extract,
    // Agent
    agentAction,
    agentSequence,
    agentSnapshot,
    // Brain
    brainAnalyze,
    brainThink,
    // Cache/Rate
    cacheStats,
    rateStats,
    // Relay
    relayStart,
    relayStop,
    relayStatus,
    // Search
    googleSearch,
  };
}
