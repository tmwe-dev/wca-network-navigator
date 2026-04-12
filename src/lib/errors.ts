/**
 * extractErrorMessage — Shared error message extraction utility.
 * Single source of truth for converting unknown catch values to readable strings.
 */
export function extractErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return String(e);
}
