import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Listens for AI bridge requests from the WhatsApp extension
 * (relayed through the content script) and calls the appropriate
 * Supabase edge function, returning the result back to the extension.
 */
export function useAiBridgeListener() {
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.source !== window) return;
      const data = event.data as
        | { direction?: string; requestId?: string; functionName?: string; payload?: unknown }
        | null;
      if (!data || data.direction !== "from-extension-ai-bridge-request") return;

      const { requestId, functionName, payload } = data;
      if (!requestId || !functionName) return;

      supabase.functions
        .invoke(functionName, { body: (payload ?? {}) as Record<string, unknown> })
        .then(({ data: result, error }) => {
          window.postMessage(
            {
              direction: "from-webapp-ai-bridge-response",
              requestId,
              result: error ? null : result,
              error: error ? error.message : null,
            },
            window.location.origin
          );
        })
        .catch((err) => {
          window.postMessage(
            {
              direction: "from-webapp-ai-bridge-response",
              requestId,
              result: null,
              error: err instanceof Error ? err.message : String(err),
            },
            window.location.origin
          );
        });
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);
}
