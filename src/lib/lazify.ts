/**
 * lazify — Lazy-load a React component with automatic retry on failure.
 *
 * Wraps `React.lazy` with a retry mechanism so that transient network
 * errors (e.g. a flaky mobile connection) don't permanently break
 * code-split chunks.  Each retry waits with exponential back-off
 * (500ms, 1000ms, ...) before re-attempting the dynamic import.
 *
 * Usage:
 * ```ts
 * const Dashboard = lazify(() => import("@/pages/Dashboard"));
 * ```
 */
import { lazy, ComponentType } from "react";

// Use prop-generic instead of `ComponentType<any>` so we keep full inference
// without an `any` boundary. Callers' props remain strict via JSX.
export function lazify<P>(factory: () => Promise<{ default: ComponentType<P> }>, retries = 2) {
  return lazy(() => retryImport(factory, retries));
}

function retryImport<P>(
  factory: () => Promise<{ default: ComponentType<P> }>,
  retriesLeft: number,
): Promise<{ default: ComponentType<P> }> {
  return factory().catch((error: unknown) => {
    if (retriesLeft <= 0) {
      throw error;
    }
    const delay = 500 * Math.pow(2, 2 - retriesLeft); // 500, 1000
    return new Promise<{ default: ComponentType<P> }>((resolve) =>
      setTimeout(() => resolve(retryImport(factory, retriesLeft - 1)), delay),
    );
  });
}
