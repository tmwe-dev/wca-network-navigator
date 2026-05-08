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
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=()",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    // CSP in Report-Only per 48h (sprint hardening 2026-05-08)
    // Promuovere a Content-Security-Policy enforcing nello sprint successivo se zero violazioni.
    "Content-Security-Policy-Report-Only": [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://*.supabase.co",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https://*.supabase.co https://*.lovable.app https://ai.gateway.lovable.dev",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  };
}
