import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";

/**
 * DEPRECATED — Deep Search Partner
 * This edge function has been replaced by client-side Deep Search via Partner Connect extension.
 * Kept for backward compatibility. Returns deprecation notice.
 */

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  return new Response(
    JSON.stringify({
      success: false,
      error: 'DEPRECATED: Deep Search now runs client-side via Partner Connect extension. Install the extension and use the app directly.',
      deprecated: true,
      replacement: 'Partner Connect extension (client-side)',
    }),
    {
      status: 410,
      headers: { ...dynCors, 'Content-Type': 'application/json' },
    }
  )
})
