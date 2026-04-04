import { lazy, type ComponentType } from "react";

/**
 * Wrapper around React.lazy that retries the import once after a delay
 * if the initial fetch fails (e.g. chunk load error after deploy).
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
