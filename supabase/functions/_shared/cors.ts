/**
 * CORS headers condivisi per tutte le edge functions.
 * Vol. II §5.3 (API contracts).
 *
 * Restrictive origin checking with backward-compatible export.
 */

const ALLOWED_ORIGINS: readonly string[] = [
  "https://wca-network-navigator.lovable.app",
  "https://id-preview--c57c2f66-1827-4bc4-9643-9b6951bf4e62.lovable.app",
  "https://c57c2f66-1827-4bc4-9643-9b6951bf4e62.lovableproject.com",
  "http://localhost:5173",
  "http://localhost:3000",
];

/**
 * Returns CORS headers scoped to a validated origin.
 * Falls back to the primary production origin if the request origin is unknown.
 */
export function getCorsHeaders(requestOrigin?: string | null): Record<string, string> {
  const origin = ALLOWED_ORIGINS.includes(requestOrigin || "")
    ? requestOrigin!
    : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  };
}

/**
 * Backward-compatible static export.
 * Edge functions that haven't migrated to getCorsHeaders() will use
 * the default production origin.
 */
export const corsHeaders = getCorsHeaders(null);

/**
 * CORS preflight handler. Returns a 204 response for OPTIONS requests.
 * Pass req to use dynamic origin; without req uses default corsHeaders.
 */
export function corsPreflight(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    const origin = req.headers.get("origin");
    return new Response(null, { headers: getCorsHeaders(origin) });
  }
  return null;
}
