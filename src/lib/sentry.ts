/**
 * Sentry integration module — Initializes error tracking, performance monitoring,
 * and session replay for the WCA Network Navigator application.
 *
 * Provides utility functions for breadcrumb tracking, user context management,
 * and structured error reporting across the application.
 */
import * as Sentry from "@sentry/react";

/**
 * Initializes the Sentry SDK with production-only configuration.
 * Sets up browser tracing, session replay, and filters out known noise
 * (ChunkLoadError, realtime XHR breadcrumbs).
 *
 * @example
 * // Called once in main.tsx before app render
 * initSentry();
 */
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
        if (breadcrumb.category === "xhr" && breadcrumb.data?.url?.includes("/realtime/")) return null;
        return breadcrumb;
      },
    });
  }
}

/**
 * Adds a navigation breadcrumb to Sentry for debugging context.
 *
 * @param route - The route path being navigated to
 *
 * @example
 * trackNavigation("/v2/crm");
 */
export function trackNavigation(route: string): void {
  Sentry.addBreadcrumb({
    category: "navigation",
    message: `Navigate to ${route}`,
    level: "info",
    data: { route },
  });
}

/**
 * Adds an Edge Function API call breadcrumb to Sentry.
 *
 * @param functionName - The name of the Edge Function called
 * @param success - Whether the call succeeded
 * @param durationMs - Optional call duration in milliseconds
 *
 * @example
 * trackApiCall("generate-email", true, 1200);
 * trackApiCall("classify-email-response", false);
 */
export function trackApiCall(functionName: string, success: boolean, durationMs?: number): void {
  Sentry.addBreadcrumb({
    category: "edge-function",
    message: `${functionName}: ${success ? "ok" : "error"}`,
    level: success ? "info" : "error",
    data: { functionName, success, durationMs },
  });
}

/**
 * Sets the authenticated user context in Sentry for error attribution.
 *
 * @param userId - The Supabase auth user ID
 * @param email - Optional user email address
 *
 * @example
 * setUserContext("abc-123", "user@example.com");
 */
export function setUserContext(userId: string, email?: string): void {
  Sentry.setUser({ id: userId, email });
}

/**
 * Clears the user context from Sentry (call on logout).
 *
 * @example
 * clearUserContext();
 */
export function clearUserContext(): void {
  Sentry.setUser(null);
}

export { Sentry };
