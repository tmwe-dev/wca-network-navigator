/**
 * health-check — uptime / liveness probe for the deployed edge runtime.
 *
 * Returns a small JSON document so external uptime monitors and the browser
 * extensions (Chrome, Email, LinkedIn, WhatsApp, RA, Partner-Connect) can
 * verify that the backend is reachable without paying for a full DB query.
 *
 * No auth required — exposes only public, non-sensitive status fields.
 */
import { corsPreflight, getCorsHeaders } from "../_shared/cors.ts";

const STARTED_AT = Date.now();

Deno.serve((req: Request) => {
  const preflight = corsPreflight(req);
  if (preflight) return preflight;

  const cors = getCorsHeaders(req.headers.get("origin"));
  const body = {
    ok: true,
    service: "wca-network-navigator-edge",
    ts: new Date().toISOString(),
    uptime_ms: Date.now() - STARTED_AT,
    region: Deno.env.get("DENO_REGION") ?? "unknown",
    version: Deno.env.get("APP_VERSION") ?? "dev",
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
});