import { useState, useEffect, useCallback, useRef } from "react";

/**
 * V3: Simplified extension bridge.
 * - No polling (demand-only ping)
 * - No stale response handling (structured contract from extension)
 * - Serial queue for extractContacts
 */

type ExtensionResponse = {
  success: boolean;
  wcaId?: number;
  state?: "ok" | "member_not_found" | "not_loaded" | "bridge_error" | "extraction_error";
  contacts?: Array<{ name?: string; title?: string; email?: string; phone?: string; mobile?: string }>;
  companyName?: string | null;
  error?: string | null;
  authenticated?: boolean;
  reason?: string;
  pageLoaded?: boolean;
  profile?: Record<string, any>;
  profileHtml?: string | null;
  htmlLength?: number;
};

// Serial queue for extractions
const LOCK_KEY = "__extractLock__";
function getLock(): { busy: boolean; queue: Array<{ resolve: (v: any) => void; fn: () => Promise<any> }> } {
  if (!(window as any)[LOCK_KEY]) (window as any)[LOCK_KEY] = { busy: false, queue: [] };
  return (window as any)[LOCK_KEY];
}

async function serialExtract<T>(fn: () => Promise<T>): Promise<T> {
  const lock = getLock();
  return new Promise<T>((resolve) => {
    const run = async () => {
      lock.busy = true;
      try { resolve(await fn()); }
      catch (err) { resolve({ success: false, error: String(err) } as any); }
      finally { lock.busy = false; const next = lock.queue.shift(); if (next) next.fn().then(next.resolve); }
    };
    if (!lock.busy) run();
    else lock.queue.push({ resolve, fn: run as any });
  });
}

export function useExtensionBridge() {
  const [isAvailable, setIsAvailable] = useState(false);
  const pendingRef = useRef<Map<string, (r: ExtensionResponse) => void>>(new Map());

  // Listen for responses
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.source !== window) return;
      const data = event.data;
      if (!data || data.direction !== "from-extension") return;
      if (data.action === "contentScriptReady") { setIsAvailable(true); return; }
      if (data.requestId && pendingRef.current.has(data.requestId)) {
        const resolve = pendingRef.current.get(data.requestId)!;
        pendingRef.current.delete(data.requestId);
        resolve(data.response);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const sendMessage = useCallback((action: string, payload?: Record<string, any>, timeoutMs = 60000): Promise<ExtensionResponse> => {
    return new Promise((resolve) => {
      const requestId = `${action}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const timer = setTimeout(() => { pendingRef.current.delete(requestId); resolve({ success: false, error: "Timeout" }); }, timeoutMs);
      pendingRef.current.set(requestId, (response) => { clearTimeout(timer); resolve(response); });
      window.postMessage({ direction: "from-webapp", action, requestId, ...payload }, window.location.origin);
    });
  }, []);

  const checkAvailable = useCallback(async (): Promise<boolean> => {
    for (let i = 0; i < 3; i++) {
      const r = await sendMessage("ping", {}, 3000);
      if (r.success) { setIsAvailable(true); return true; }
      if (i < 2) await new Promise((r) => setTimeout(r, 800));
    }
    return false;
  }, [sendMessage]);

  const extractContacts = useCallback((wcaId: number): Promise<ExtensionResponse> => {
    return serialExtract(() => sendMessage("extractContacts", { wcaId }, 60000));
  }, [sendMessage]);

  const verifySession = useCallback((): Promise<ExtensionResponse> => {
    return sendMessage("verifySession", {}, 10000);
  }, [sendMessage]);

  return { isAvailable, checkAvailable, extractContacts, verifySession };
}
