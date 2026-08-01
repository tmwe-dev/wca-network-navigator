/**
 * inputValidator.ts — Shared input validation helpers for Edge Functions.
 * Sanitize user-provided strings, validate UUIDs and emails.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Trim + truncate a string to maxLength. Returns empty string for non-strings. */
export function sanitizeString(input: unknown, maxLength = 5000): string {
  if (typeof input !== "string") return "";
  return input.trim().slice(0, maxLength);
}

/** Returns true if input is a valid UUID v4 format. */
export function validateUUID(input: unknown): input is string {
  return typeof input === "string" && UUID_RE.test(input);
}

/** Returns true if input looks like a valid email address. */
export function validateEmail(input: unknown): input is string {
  return typeof input === "string" && input.length <= 320 && EMAIL_RE.test(input);
}

/** Validate and return a sanitized string, or throw with fieldName context. */
export function requireString(input: unknown, fieldName: string, maxLength = 5000): string {
  const s = sanitizeString(input, maxLength);
  if (!s) throw new Error(`${fieldName} is required`);
  return s;
}

/** Validate and return a UUID, or throw with fieldName context. */
export function requireUUID(input: unknown, fieldName: string): string {
  if (!validateUUID(input)) throw new Error(`${fieldName} must be a valid UUID`);
  return input;
}

/* ──────────────────────────────────────────────────────────────────────
 * SSRF guard — assertSafePublicUrl
 * P1.4: blocca URL che puntano a IP privati / loopback / metadata cloud
 * o a schemi non http(s). Da usare PRIMA di ogni fetch() di URL fornito
 * dall'utente (deep-search, enrich, scrape).
 * ────────────────────────────────────────────────────────────────────── */

const PRIVATE_IPV4_RANGES: Array<[number, number, number, number, number]> = [
  // [a, b, c, d, mask-bits] — confronto su /N
  [10, 0, 0, 0, 8],
  [127, 0, 0, 0, 8],
  [169, 254, 0, 0, 16], // link-local + cloud metadata (169.254.169.254)
  [172, 16, 0, 0, 12],
  [192, 0, 0, 0, 24],
  [192, 168, 0, 0, 16],
  [198, 18, 0, 0, 15],
  [0, 0, 0, 0, 8],     // 0.0.0.0/8
  [100, 64, 0, 0, 10], // CGNAT
];

function ipv4ToInt(a: number, b: number, c: number, d: number): number {
  return ((a << 24) | (b << 16) | (c << 8) | d) >>> 0;
}

function isPrivateIPv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const parts = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
  if (parts.some((n) => n < 0 || n > 255)) return true; // invalid → block
  const ip = ipv4ToInt(parts[0], parts[1], parts[2], parts[3]);
  for (const [a, b, c, d, bits] of PRIVATE_IPV4_RANGES) {
    const base = ipv4ToInt(a, b, c, d);
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    if ((ip & mask) === (base & mask)) return true;
  }
  return false;
}

function isPrivateIPv6(host: string): boolean {
  // Strip brackets if present
  const h = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (!h.includes(":")) return false;
  // ::1 loopback, fc00::/7 unique-local, fe80::/10 link-local, ::ffff:IPv4 mapped
  if (h === "::1" || h === "::") return true;
  if (h.startsWith("fc") || h.startsWith("fd")) return true;
  if (h.startsWith("fe8") || h.startsWith("fe9") || h.startsWith("fea") || h.startsWith("feb")) return true;
  const mapped = h.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  return false;
}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata",
  "instance-data",
]);

export interface AssertSafeUrlOptions {
  /** Allowed protocols (default: http, https). */
  protocols?: string[];
  /** Optional hostname allowlist (suffix match). If set, ONLY these are allowed. */
  allowHostSuffixes?: string[];
}

/**
 * Validate that the given URL string is safe to fetch from server-side context.
 * Throws Error("ssrf_blocked: ...") on any violation.
 */
export function assertSafePublicUrl(
  rawUrl: string,
  opts: AssertSafeUrlOptions = {},
): URL {
  const { protocols = ["http:", "https:"], allowHostSuffixes } = opts;
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("ssrf_blocked: invalid_url");
  }
  if (!protocols.includes(parsed.protocol)) {
    throw new Error(`ssrf_blocked: protocol_${parsed.protocol.replace(":", "")}`);
  }
  // Strip credentials in URL (often used to confuse parsers)
  if (parsed.username || parsed.password) {
    throw new Error("ssrf_blocked: credentials_in_url");
  }
  const host = parsed.hostname.toLowerCase();
  if (!host) throw new Error("ssrf_blocked: empty_host");
  if (BLOCKED_HOSTNAMES.has(host)) throw new Error("ssrf_blocked: hostname");
  if (host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("ssrf_blocked: internal_tld");
  }
  if (isPrivateIPv4(host) || isPrivateIPv6(host)) {
    throw new Error("ssrf_blocked: private_ip");
  }
  if (allowHostSuffixes && allowHostSuffixes.length > 0) {
    const ok = allowHostSuffixes.some((suf) => host === suf || host.endsWith(`.${suf}`));
    if (!ok) throw new Error("ssrf_blocked: host_not_in_allowlist");
  }
  return parsed;
}

/** Non-throwing variant: returns null if blocked. */
export function safePublicUrlOrNull(
  rawUrl: string,
  opts: AssertSafeUrlOptions = {},
): URL | null {
  try {
    return assertSafePublicUrl(rawUrl, opts);
  } catch {
    return null;
  }
}
