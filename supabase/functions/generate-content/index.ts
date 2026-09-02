/**
 * generate-content — Macro-function for all content generation.
 * Routes by body.action: email | outreach | improve | analyze_edit
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { forwardToFunction } from "../_shared/proxyUtils.ts";
import { requireInternalOrUser } from "../_shared/internalAuth.ts";
import { createLogger } from "../_shared/structuredLogger.ts";
import { edgeErrorWithStatus } from "../_shared/handleEdgeError.ts";
import { trackUsage } from "../_shared/usageTrack.ts";

const log = createLogger("generate-content");

serve(async (req) => {
  trackUsage("generate-content", "quarantine", { note: "Q2 bonifica, scadenza 2026-10-02" });
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
    return edgeErrorWithStatus("AUTH_REQUIRED", "AUTH_REQUIRED", 401, {
      ...dynCors,
      "Content-Type": "application/json",
    });
  }

  try {
    const body = await req.json();
    const action = body.action || "email";

    // Forward to original functions (they contain complex logic)
    switch (action) {
      case "email":
        return forwardToFunction("generate-email", body, req.headers);
      case "outreach":
        return forwardToFunction("generate-outreach", body, req.headers);
      case "improve":
        return forwardToFunction("improve-email", body, req.headers);
      case "analyze_edit":
        return forwardToFunction("analyze-email-edit", body, req.headers);
      default:
        return edgeErrorWithStatus("VALIDATION_ERROR", `Unknown action: ${action}`, 400, {
          ...dynCors,
          "Content-Type": "application/json",
        });
    }
  } catch (e: unknown) {
    log.error("generate-content error:", e);
    const message = e instanceof Error ? e.message : String(e);
    return edgeErrorWithStatus("INTERNAL_ERROR", message || "Unknown error", 500, {
      ...dynCors,
      "Content-Type": "application/json",
    });
  }
});
