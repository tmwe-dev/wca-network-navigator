import * as Sentry from "@sentry/react";

export function initSentry() {
  if (import.meta.env.PROD) {
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
        // Filter out noisy breadcrumbs
        if (breadcrumb.category === "xhr" && breadcrumb.data?.url?.includes("/realtime/")) return null;
        return breadcrumb;
      },
    });
  }
}

/** Add navigation breadcrumb */
export function trackNavigation(route: string): void {
  Sentry.addBreadcrumb({
    category: "navigation",
    message: `Navigate to ${route}`,
    level: "info",
    data: { route },
  });
}

/** Add API call breadcrumb */
export function trackApiCall(functionName: string, success: boolean, durationMs?: number): void {
  Sentry.addBreadcrumb({
    category: "edge-function",
    message: `${functionName}: ${success ? "ok" : "error"}`,
    level: success ? "info" : "error",
    data: { functionName, success, durationMs },
  });
}

/** Set authenticated user context */
export function setUserContext(userId: string, email?: string): void {
  Sentry.setUser({ id: userId, email });
}

/** Clear user context on logout */
export function clearUserContext(): void {
  Sentry.setUser(null);
}

export { Sentry };
