import { lazy, type ComponentType } from "react";

/**
 * Wrapper around React.lazy that retries the dynamic import once after a delay
 * if the initial fetch fails (e.g., chunk load error after a deploy).
 * This prevents white screens when users have stale chunks cached.
 *
 * @param factory - A function that returns a Promise resolving to a module with a default export
 * @param retryDelay - Milliseconds to wait before retrying (default: 1500ms)
 * @returns A lazy React component that will auto-retry on import failure
 *
 * @example
 * const MyPage = lazyRetry(() => import("./pages/MyPage"));
 * // Use in routes: <Route element={<MyPage />} />
 */
export function lazyRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  retryDelay = 1500
) {
  return lazy(() =>
    factory().catch(() =>
      new Promise<{ default: T }>((resolve, reject) => {
        setTimeout(() => {
          factory().then(resolve).catch(reject);
        }, retryDelay);
      })
    )
  );
}
