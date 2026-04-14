import { useState, useEffect, useCallback, useRef } from "react";

/**
 * V5: Extension bridge with improved reliability.
 * - Content script handles ping locally (fast)
 * - Heartbeat-based availability detection
 * - Serial queue for extractions
 * - Returns BridgeResult with bridgeHealthy flag
 */

export type ExtractionResult = {
  success: boolean;
  wcaId?: number;
  state: "ok" | "member_not_found" | "not_loaded" | "login_required" | "extraction_error" | "bridge_error";
  errorCode?: string | null;
  companyName?: string | null;
  contacts?: Array<{ name?: string; title?: string; email?: string; phone?: string; mobile?: string }>;
  profile?: Record<string, unknown>;
  profileHtml?: string | null;
  htmlLength?: number;
  error?: string | null;
  debug?: Record<string, unknown>;
};

export type BridgeResult = {
  bridgeHealthy: boolean;
  bridgeError?: string;
  extraction: ExtractionResult | null;
};

type RawResponse = ExtractionResult & { authenticated?: boolean; reason?: string; message?: string };

// Serial queue
const LOCK_KEY = "__extractLock__";
function getLock(): { busy: boolean; queue: Array<{ resolve: (v: string) => void; fn: () => Promise<unknown> }> } {
  if (!(window as Record<string, unknown>)[LOCK_KEY]) (window as Record<string, unknown>)[LOCK_KEY] = { busy: false, queue: [] };
  return (window as Record<string, unknown>)[LOCK_KEY];
}

async function serialExtract<T>(fn: () => Promise<T>): Promise<T> {
  const lock = getLock();
  return new Promise<T>((resolve) => {
    const run = async () => {
      lock.busy = true;
      try { resolve(await fn()); }
      catch (err) { resolve({ bridgeHealthy: false, bridgeError: String(err), extraction: null }); }
      finally { lock.busy = false; const next = lock.queue.shift(); if (next) next.fn().then(next.resolve); }
    };
    if (!lock.busy) run();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Function signature variance in lock queue
    else lock.queue.push({ resolve, fn: run as any });
  });
}

export function useExtensionBridge() {
  const [isAvailable, setIsAvailable] = useState(false);
  const pendingRef = useRef<Map<string, (r: RawResponse) => void>>(new Map());
  const lastHeartbeatRef = useRef<number>(0);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.source !== window) return;
      const data = event.data;
      if (!data || data.direction !== "from-extension") return;
      if (data.action === "contentScriptReady") {
        setIsAvailable(true);
        lastHeartbeatRef.current = Date.now();
        return;
      }
      if (data.requestId && pendingRef.current.has(data.requestId)) {
        const resolve = pendingRef.current.get(data.requestId)!;
        pendingRef.current.delete(data.requestId);
        resolve(data.response);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const sendMessage = useCallback((action: string, payload?: Record<string, unknown>, timeoutMs = 60000): Promise<RawResponse> => {
    return new Promise((resolve) => {
      const requestId = `${action}_${crypto.randomUUID()}`;
      const timer = setTimeout(() => {
        pendingRef.current.delete(requestId);
        resolve({ success: false, state: "bridge_error", errorCode: "EXT_BRIDGE_TIMEOUT", error: "Timeout" } as RawResponse);
      }, timeoutMs);
      pendingRef.current.set(requestId, (response) => { clearTimeout(timer); resolve(response); });
      window.postMessage({ direction: "from-webapp", action, requestId, ...payload }, window.location.origin);
    });
  }, []);

  const checkAvailable = useCallback(async (): Promise<boolean> => {
    // Quick check: if heartbeat was recent, we're good
    if (Date.now() - lastHeartbeatRef.current < 15000) {
      setIsAvailable(true);
      return true;
    }
    // Ping with retries
    for (let i = 0; i < 3; i++) {
      const r = await sendMessage("ping", {}, 3000);
      if (r.success) { setIsAvailable(true); lastHeartbeatRef.current = Date.now(); return true; }
      if (i < 2) await new Promise((r) => setTimeout(r, 800));
    }
    return false;
  }, [sendMessage]);

  const extractContacts = useCallback((wcaId: number): Promise<BridgeResult> => {
    return serialExtract(async () => {
      const raw = await sendMessage("extractContacts", { wcaId }, 60000);

      // Bridge-level failure
      if (raw.error === "Timeout" || raw.errorCode === "EXT_BRIDGE_TIMEOUT" || raw.errorCode === "EXT_NO_CONTENT_SCRIPT" || raw.errorCode === "EXT_CONTEXT_INVALIDATED") {
        return { bridgeHealthy: false, bridgeError: raw.errorCode || "EXT_BRIDGE_TIMEOUT", extraction: null };
      }

      // Bridge worked, return extraction result
      return {
        bridgeHealthy: true,
        extraction: {
          success: raw.success ?? false,
          wcaId: raw.wcaId,
          state: raw.state || (raw.success ? "ok" : "not_loaded"),
          errorCode: raw.errorCode || null,
          companyName: raw.companyName || null,
          contacts: raw.contacts || [],
          profile: raw.profile || {},
          profileHtml: raw.profileHtml || null,
          htmlLength: raw.htmlLength || 0,
          error: raw.error || null,
          debug: raw.debug || {},
        }
      };
    });
  }, [sendMessage]);

  const verifySession = useCallback((): Promise<RawResponse> => {
    return sendMessage("verifySession", {}, 10000);
  }, [sendMessage]);

  const preflightTest = useCallback((): Promise<RawResponse> => {
    return sendMessage("preflightTest", {}, 30000);
  }, [sendMessage]);

  return { isAvailable, checkAvailable, extractContacts, verifySession, preflightTest };
}
