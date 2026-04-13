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
