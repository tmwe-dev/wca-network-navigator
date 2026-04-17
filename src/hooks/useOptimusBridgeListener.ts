import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { createLogger } from "@/lib/log";

const log = createLogger("useOptimusBridgeListener");

type OptimusRequest = {
  direction: "from-extension-optimus-request";
  requestId: string;
  channel: "whatsapp" | "linkedin";
  pageType: "sidebar" | "thread" | "inbox" | "messaging";
  snapshot: string;
  hash: string;
  previousPlanFailed?: boolean;
  failureContext?: string | null;
};

type OptimusEvent =
  | { kind: "cache-hit"; channel: string; pageType: string; planVersion: number }
  | { kind: "ai-fresh"; channel: string; pageType: string; latencyMs: number; confidence: number; planVersion: number }
  | { kind: "stale"; channel: string; pageType: string }
  | { kind: "error"; channel: string; pageType: string; error: string };

let listenerInstalled = false;
const eventSubscribers = new Set<(e: OptimusEvent) => void>();

function emit(e: OptimusEvent) {
  for (const fn of eventSubscribers) {
    try { fn(e); } catch (_) { /* ignore */ }
  }
}

export function subscribeOptimusEvents(cb: (e: OptimusEvent) => void): () => void {
  eventSubscribers.add(cb);
  return () => { eventSubscribers.delete(cb); };
}

/**
 * Mounts a single global listener that the WA/LI extensions call to fetch
 * extraction plans from the optimus-analyze edge function.
 *
 * Should be mounted once near the app root inside an authenticated context.
 */
export function useOptimusBridgeListener() {
  const inFlight = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (listenerInstalled) return;
    listenerInstalled = true;

    async function handler(event: MessageEvent) {
      if (event.source !== window) return;
      const data = event.data as OptimusRequest | undefined;
      if (!data || data.direction !== "from-extension-optimus-request") return;
      if (!data.requestId || inFlight.current.has(data.requestId)) return;
      inFlight.current.add(data.requestId);

      try {
        const t0 = performance.now();
        const { data: result, error } = await supabase.functions.invoke("optimus-analyze", {
          body: {
            channel: data.channel,
            page_type: data.pageType,
            dom_snapshot: data.snapshot,
            dom_hash: data.hash,
            previous_plan_failed: !!data.previousPlanFailed,
            failure_context: data.failureContext || undefined,
          },
        });
        const latency = Math.round(performance.now() - t0);

        if (error) {
          emit({ kind: "error", channel: data.channel, pageType: data.pageType, error: error.message });
          replyToExtension(data.requestId, { success: false, error: error.message, code: "EDGE_ERROR" });
          return;
        }

        if (result?.stale) {
          emit({ kind: "stale", channel: data.channel, pageType: data.pageType });
        } else if (result?.cached) {
          emit({ kind: "cache-hit", channel: data.channel, pageType: data.pageType, planVersion: result.plan_version || 0 });
        } else {
          emit({
            kind: "ai-fresh",
            channel: data.channel,
            pageType: data.pageType,
            latencyMs: result?.ai_latency_ms || latency,
            confidence: result?.confidence || 0,
            planVersion: result?.plan_version || 0,
          });
        }

        // Flatten so getPlan() in optimus-client.js sees success/plan/cached at top level
        replyToExtension(data.requestId, { success: true, ...(result || {}) });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log.warn("optimus bridge error", { error: message });
        emit({ kind: "error", channel: data.channel, pageType: data.pageType, error: message });
        replyToExtension(data.requestId, { success: false, error: message });
      } finally {
        inFlight.current.delete(data.requestId);
      }
    }

    window.addEventListener("message", handler);
    return () => {
      window.removeEventListener("message", handler);
      listenerInstalled = false;
    };
  }, []);
}

function replyToExtension(requestId: string, payload: Record<string, unknown>) {
  // The extension content scripts (WA + LI) listen for this message and
  // forward it to the background as { source:"wca-optimus-response",
  // requestId, payload } — Optimus.getPlan in optimus-client.js then resolves
  // with `payload` directly, so the structure here MUST stay nested.
  window.postMessage(
    {
      direction: "from-webapp-optimus-response",
      requestId,
      payload,
    },
    window.location.origin
  );
}
