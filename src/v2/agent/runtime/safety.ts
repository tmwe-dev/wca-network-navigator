/**
 * safety.ts — Forbidden patterns and validators for the agent.
 * Ported from wca-test-runner/agent.js safety section.
 */

const FORBIDDEN_PATTERNS = [
  /delete\s+account/i,
  /drop\s+table/i,
  /truncate/i,
  /sign\s*out/i,
  /logout/i,
  /rm\s+-rf/i,
  /format\s+disk/i,
  /password\s*reset/i,
  /transfer\s+funds/i,
  /payment/i,
  /credit\s*card/i,
  /admin\s*panel/i,
];

const FORBIDDEN_URL_PATTERNS = [
  /javascript:/i,
  /data:/i,
  /file:/i,
  /chrome:/i,
  /about:/i,
];

/**
 * Checks if a tool call is forbidden by safety rules.
 */
export function isForbidden(toolName: string, args: Record<string, unknown>): boolean {
  const argsStr = JSON.stringify(args).toLowerCase();

  // Check forbidden patterns in args
  if (FORBIDDEN_PATTERNS.some((p) => p.test(argsStr))) {
    return true;
  }

  // Check forbidden URLs in navigate
  if (toolName === "navigate") {
    const path = String(args.path ?? "");
    if (FORBIDDEN_URL_PATTERNS.some((p) => p.test(path))) {
      return true;
    }
  }

  // Check forbidden selectors in click
  if (toolName === "click") {
    const selector = String(args.selector ?? "");
    if (/logout|signout|sign-out|delete-account/i.test(selector)) {
      return true;
    }
  }

  return false;
}

/**
 * Validates that a URL is safe to navigate to.
 */
export function isUrlSafe(url: string): boolean {
  if (FORBIDDEN_URL_PATTERNS.some((p) => p.test(url))) return false;
  // Only allow same-origin or HTTPS
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.origin === window.location.origin || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
