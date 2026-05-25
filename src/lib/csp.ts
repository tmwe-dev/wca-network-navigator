/**
 * csp.ts — Content Security Policy header for the WCA Network Navigator SPA.
 *
 * Sprint G: centralised CSP definition for the React frontend.
 * Edge functions use their own CSP via `securityHeaders.ts`.
 */

const CSP_DIRECTIVES: Record<string, string[]> = {
  "default-src": ["'self'"],
  "script-src": ["'self'", "'unsafe-inline'", "https://*.supabase.co", "https://*.lovable.app", "https://*.lovable.dev"],
  "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  "img-src": ["'self'", "data:", "blob:", "https:"],
  "font-src": ["'self'", "data:", "https://fonts.gstatic.com"],
  "connect-src": [
    "'self'",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    "https://*.lovable.app",
    "https://*.lovable.dev",
    "https://ai.gateway.lovable.dev",
    "https://fonts.googleapis.com",
    "https://fonts.gstatic.com",
  ],
  "frame-ancestors": ["'self'", "https://*.lovable.app", "https://*.lovable.dev"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
  "object-src": ["'none'"],
};

/**
 * Serialised CSP header value ready to be set as
 * `Content-Security-Policy` on HTTP responses.
 */
export const CSP_HEADER: string = Object.entries(CSP_DIRECTIVES)
  .map(([directive, sources]) => (sources.length > 0 ? `${directive} ${sources.join(" ")}` : directive))
  .join("; ");

/**
 * Returns a `<meta>` tag string for injecting CSP into an HTML document head.
 * Useful for static SPA hosting where HTTP headers cannot be set.
 */
export function cspMetaTag(): string {
  return `<meta http-equiv="Content-Security-Policy" content="${CSP_HEADER}">`;
}
