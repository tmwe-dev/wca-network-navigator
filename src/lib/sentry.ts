/**
 * Sentry integration module — Lazy-loaded to avoid 410KB in critical path.
 *
 * All Sentry operations are no-ops until the SDK is loaded.
 * initSentry() triggers the async load in production only.
 */

let _Sentry: typeof import("@sentry/react") | null = null;
let _loadPromise: Promise<typeof import("@sentry/react")> | null = null;

function getSentryAsync(): Promise<typeof import("@sentry/react")> {
  if (_Sentry) return Promise.resolve(_Sentry);
  if (!_loadPromise) {
    _loadPromise = import("@sentry/react").then((mod) => {
      _Sentry = mod;
      return mod;
    });
  }
  return _loadPromise;
}

/**
 * Initializes the Sentry SDK with production-only configuration.
 * Loads the SDK asynchronously to avoid blocking the critical path.
 */
export async function initSentry() {
  if (!import.meta.env.PROD) return;

  const Sentry = await getSentryAsync();
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN || "",
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_APP_VERSION || "unknown",
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
    ],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.5,
    beforeSend(event) {
      if (event.exception?.values?.some(v => v.type === "ChunkLoadError")) return null;
      return event;
    },
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.category === "xhr" && breadcrumb.data?.url?.includes("/realtime/")) return null;
      return breadcrumb;
    },
  });
}

/**
 * Adds a navigation breadcrumb to Sentry for debugging context.
 */
export function trackNavigation(route: string): void {
  if (_Sentry) {
    _Sentry.addBreadcrumb({
      category: "navigation",
      message: `Navigate to ${route}`,
      level: "info",
      data: { route },
    });
  }
}

/**
 * Adds an Edge Function API call breadcrumb to Sentry.
 */
export function trackApiCall(functionName: string, success: boolean, durationMs?: number): void {
  if (_Sentry) {
    _Sentry.addBreadcrumb({
      category: "edge-function",
      message: `${functionName}: ${success ? "ok" : "error"}`,
      level: success ? "info" : "error",
      data: { functionName, success, durationMs },
    });
  }
}

/**
 * Sets the authenticated user context in Sentry.
 */
export function setUserContext(userId: string, email?: string): void {
  if (_Sentry) _Sentry.setUser({ id: userId, email });
}

/**
 * Clears the user context from Sentry (call on logout).
 */
export function clearUserContext(): void {
  if (_Sentry) _Sentry.setUser(null);
}

/**
 * Proxy object for safe access to Sentry methods.
 * Methods are no-ops until the SDK loads.
 */
export const Sentry = {
  addBreadcrumb: (...args: Parameters<typeof import("@sentry/react").addBreadcrumb>) => {
    _Sentry?.addBreadcrumb(...args);
  },
  captureException: (...args: Parameters<typeof import("@sentry/react").captureException>) => {
    _Sentry?.captureException(...args);
  },
  setUser: (user: { id: string; email?: string } | null) => {
    _Sentry?.setUser(user);
  },
  /** ErrorBoundary must be loaded synchronously for App.tsx — use GlobalErrorBoundary instead */
  ErrorBoundary: null as unknown,
};
