/**
 * CSRF / Origin validation utility for Edge Functions.
 */
export function validateOrigin(req: Request, allowedOrigins: string[]): boolean {
  const origin = req.headers.get("Origin") || req.headers.get("Referer") || "";
  return allowedOrigins.some((allowed) => origin.startsWith(allowed));
}
