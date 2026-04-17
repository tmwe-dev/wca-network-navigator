import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Bridge AI Extract — instrada le richieste AI delle estensioni
 * (WhatsApp / LinkedIn) e le chiamate cookie/credentials LinkedIn
 * verso le edge function via fetch dal dominio della webapp,
 * aggirando il blocco CORS che colpisce le origini chrome-extension://.
 *
 * Eventi accettati su window:
 *  - from-extension-ai-request          → whatsapp-ai-extract / linkedin-ai-extract
 *  - from-extension-li-cookie-request   → save-linkedin-cookie
 *  - from-extension-li-creds-request    → get-linkedin-credentials
 *
 * Eventi pubblicati:
 *  - from-webapp-ai-response
 *  - from-webapp-li-cookie-response
 *  - from-webapp-li-creds-response
 *
 * Ogni richiesta porta un requestId opzionale che viene rispedito tale
 * e quale per consentire al lato extension di correlare la risposta.
 */
export function useAiExtractBridgeListener() {
  useEffect(() => {
    const handler = async (event: MessageEvent) => {
      const data = event.data as
        | {
            direction?: string;
            requestId?: string;
            payload?: Record<string, unknown>;
          }
        | undefined;
      if (!data?.direction) return;

      // ── AI Extract (WA / LI) ─────────────────────────────
      if (data.direction === "from-extension-ai-request") {
        const payload = (data.payload ?? {}) as {
          channel?: string;
          mode?: string;
          html?: string;
          snapshot?: unknown;
          pageType?: string;
        };
        const edgeFn =
          payload.channel === "linkedin"
            ? "linkedin-ai-extract"
            : "whatsapp-ai-extract";
        try {
          const body: Record<string, unknown> = { mode: payload.mode };
          if (payload.html !== undefined) body.html = payload.html;
          if (payload.snapshot !== undefined) body.snapshot = payload.snapshot;
          if (payload.pageType !== undefined) body.pageType = payload.pageType;

          const res = await supabase.functions.invoke(edgeFn, { body });
          if (res.error) throw res.error;
          window.postMessage(
            {
              direction: "from-webapp-ai-response",
              requestId: data.requestId,
              payload: { success: true, data: res.data },
            },
            "*",
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          window.postMessage(
            {
              direction: "from-webapp-ai-response",
              requestId: data.requestId,
              payload: { success: false, error: message },
            },
            "*",
          );
        }
        return;
      }

      // ── LinkedIn cookie sync ─────────────────────────────
      if (data.direction === "from-extension-li-cookie-request") {
        const payload = (data.payload ?? {}) as { cookie?: string };
        try {
          const res = await supabase.functions.invoke("save-linkedin-cookie", {
            body: { cookie: payload.cookie },
          });
          if (res.error) throw res.error;
          window.postMessage(
            {
              direction: "from-webapp-li-cookie-response",
              requestId: data.requestId,
              payload: { success: true, data: res.data },
            },
            "*",
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          window.postMessage(
            {
              direction: "from-webapp-li-cookie-response",
              requestId: data.requestId,
              payload: { success: false, error: message },
            },
            "*",
          );
        }
        return;
      }

      // ── LinkedIn credentials lookup ──────────────────────
      if (data.direction === "from-extension-li-creds-request") {
        try {
          const res = await supabase.functions.invoke(
            "get-linkedin-credentials",
            { body: {} },
          );
          if (res.error) throw res.error;
          window.postMessage(
            {
              direction: "from-webapp-li-creds-response",
              requestId: data.requestId,
              payload: { success: true, data: res.data },
            },
            "*",
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          window.postMessage(
            {
              direction: "from-webapp-li-creds-response",
              requestId: data.requestId,
              payload: { success: false, error: message },
            },
            "*",
          );
        }
        return;
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);
}
