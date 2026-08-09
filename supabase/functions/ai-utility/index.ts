/**
 * ai-utility — Macro-function for lightweight AI utilities.
 * Routes by body.action: briefing | categorize | deep_search
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { forwardToFunction } from "../_shared/proxyUtils.ts";
import { requireInternalOrUser } from "../_shared/internalAuth.ts";
import { createLogger } from "../_shared/structuredLogger.ts";
import { edgeErrorWithStatus } from "../_shared/handleEdgeError.ts";

const log = createLogger("ai-utility");

serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);
  // Auth condiviso: JWT utente oppure chiamata interna server-to-server.
  const auth = await requireInternalOrUser(req, null, dynCors);
  if (auth.kind === "error") return auth.response;

  // Auth check before forwarding
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return edgeErrorWithStatus("AUTH_REQUIRED", "AUTH_REQUIRED", 401, { ...dynCors, "Content-Type": "application/json" });
  }

  try {
    const body = await req.json();
    const action = body.action || "briefing";

    switch (action) {
      case "briefing":
        return forwardToFunction("daily-briefing", body, req.headers);
      case "categorize":
        return forwardToFunction("categorize-content", body, req.headers);
      case "deep_search":
        return forwardToFunction("ai-deep-search-helper", body, req.headers);
      default:
        return edgeErrorWithStatus("VALIDATION_ERROR", `Unknown action: ${action}`, 400, { ...dynCors, "Content-Type": "application/json" });
    }
  } catch (e: Record<string, unknown>) {
    log.error("ai-utility error:", e);
    return edgeErrorWithStatus("INTERNAL_ERROR", e.message || "Unknown error", 500, { ...dynCors, "Content-Type": "application/json" });
  }
});
