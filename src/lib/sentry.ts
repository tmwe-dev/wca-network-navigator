import React from "react";

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
    replaysOnErrorSampleRate: 1.0,
    beforeSend(event) {
      if (event.exception?.values?.some((v) => v.type === "ChunkLoadError")) return null;
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

/**
 * Sprint H — React Error Boundary wrapper powered by Sentry.
 * Falls back to a generic error UI when the SDK has not loaded yet.
 *
 * Uses React.createElement to stay in a .ts file (no JSX).
 */
export function SentryErrorBoundary({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}): React.ReactElement {
  if (_Sentry) {
    const SentryEB = _Sentry.ErrorBoundary;
    const fb = (fallback ?? React.createElement(DefaultErrorFallback, null)) as React.ReactElement;
    return React.createElement(
      SentryEB,
      { fallback: fb },
      children,
    );
  }

  // SDK not yet loaded — render children directly (errors bubble to window.onerror).
  return React.createElement(React.Fragment, null, children);
}

/** Minimal fallback UI shown when an error boundary catches. */
function DefaultErrorFallback(): React.ReactElement {
  return React.createElement(
    "div",
    { style: { padding: 32, textAlign: "center" as const } },
    React.createElement("h2", null, "Something went wrong"),
    React.createElement("p", null, "The error has been reported. Please reload the page."),
  );
}
