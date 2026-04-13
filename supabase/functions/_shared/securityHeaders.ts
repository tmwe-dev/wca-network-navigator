/**
 * Security response headers for Edge Functions.
 * Adds defense-in-depth HTTP headers to all responses.
 */
export function getSecurityHeaders(corsHeaders: Record<string, string>): Record<string, string> {
  return {
    ...corsHeaders,
    "Content-Type": "application/json",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  };
}
