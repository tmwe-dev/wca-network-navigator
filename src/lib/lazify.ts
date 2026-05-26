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

export function lazify<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>, retries = 2) {
  return lazy(() => retryImport(factory, retries));
}

function retryImport<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  retriesLeft: number,
): Promise<{ default: T }> {
  return factory().catch((error: unknown) => {
    if (retriesLeft <= 0) {
      throw error;
    }
    const delay = 500 * Math.pow(2, 2 - retriesLeft); // 500, 1000
    return new Promise<{ default: T }>((resolve) =>
      setTimeout(() => resolve(retryImport(factory, retriesLeft - 1)), delay),
    );
  });
}
