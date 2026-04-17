import { lazy, type ComponentType } from "react";

/**
 * Wrapper around React.lazy that retries the dynamic import once after a delay
 * if the initial fetch fails (e.g., chunk load error after a deploy or proxy hiccup).
 * This prevents white screens when users have stale chunks cached or when the
 * Lovable Preview proxy intermittently fails to serve a chunk.
 *
 * Signature mirrors React.lazy itself (ComponentType<any>) so callers don't have
 * to constrain props to Record<string, unknown>.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  retryDelay = 1500
) {
  return lazy(() =>
    factory().catch((err) => {
      // eslint-disable-next-line no-console
      console.warn("[lazyRetry] dynamic import failed, retrying in", retryDelay, "ms", err);
      return new Promise<{ default: T }>((resolve, reject) => {
        setTimeout(() => {
          factory()
            .then(resolve)
            .catch((err2) => {
              // eslint-disable-next-line no-console
              console.error("[lazyRetry] retry failed", err2);
              reject(err2);
            });
        }, retryDelay);
      });
    })
  );
}
