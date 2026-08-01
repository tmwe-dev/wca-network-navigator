/**
 * swallowedError.ts
 *
 * Centralized helper to log previously-silent `catch {}` blocks without
 * changing control flow. Never throws.
 *
 * Usage:
 *   try { ... } catch (e) { swallowedError("audit_insert_failed", e, { fnName: "agent-autonomous-cycle" }); }
 */

export function swallowedError(
  context: string,
  err: unknown,
  extra: Record<string, unknown> = {},
): void {
  try {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    // One-line JSON so Supabase log search works.
    console.warn(
      JSON.stringify({
        type: "swallowed_error",
        context,
        message,
        stack,
        ...extra,
        timestamp: new Date().toISOString(),
      }),
    );
  } catch {
    // logger must never throw
  }
}