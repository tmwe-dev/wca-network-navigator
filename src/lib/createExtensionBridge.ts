/**
 * Generic factory for Chrome extension bridges.
 *
 * All existing bridge hooks (useExtensionBridge, useLinkedInExtensionBridge,
 * useFireScrapeExtensionBridge, useWhatsAppExtensionBridge) follow the same
 * core pattern:
 *   1. Listen on `window "message"` for a specific `direction` tag
 *   2. Track availability via "contentScriptReady" / polling
 *   3. Send messages via `window.postMessage` with a unique requestId
 *   4. Resolve a pending promise when the response arrives, or timeout
 *
 * This factory extracts that common skeleton into a reusable, type-safe
 * function that can be wrapped inside a React hook or used standalone.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ExtensionBridgeConfig {
  /** Direction tag coming FROM the extension (e.g. "from-extension-li"). */
  inboundDirection: string;
  /** Direction tag sent TO the extension (e.g. "from-webapp-li"). */
  outboundDirection: string;
  /**
   * Short prefix for request IDs (e.g. "li", "fs", "wa").
   * Used to generate unique IDs like `li_ping_1712345678901_abc`.
   */
  idPrefix: string;
  /** Polling interval in ms for availability pings. 0 = no polling. Default 3000. */
  pollIntervalMs?: number;
  /** Default timeout for sendMessage in ms. Default 60000. */
  defaultTimeoutMs?: number;
}

export interface ExtensionBridge<TResponse = Record<string, unknown>> {
  /** Whether the extension content script is currently reachable. */
  isAvailable: () => boolean;
  /**
   * Send a message to the extension and wait for a response.
   * Rejects on timeout with a `{ success: false, error: "Timeout" }` shape.
   */
  sendMessage: <T = TResponse>(
    action: string,
    payload?: Record<string, unknown>,
    timeoutMs?: number,
  ) => Promise<T>;
  /** Start the message listener and optional polling. Call once on mount. */
  start: () => void;
  /** Tear down listeners and polling. Call on unmount. */
  stop: () => void;
  /** Subscribe to availability changes. Returns an unsubscribe function. */
  onAvailabilityChange: (cb: (available: boolean) => void) => () => void;
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createExtensionBridge<TResponse = Record<string, unknown>>(
  config: ExtensionBridgeConfig,
): ExtensionBridge<TResponse> {
  const {
    inboundDirection,
    outboundDirection,
    idPrefix,
    pollIntervalMs = 3_000,
    defaultTimeoutMs = 60_000,
  } = config;

  let available = false;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  const pending = new Map<string, (response: unknown) => void>();
  const availabilityListeners = new Set<(available: boolean) => void>();

  // ── Helpers ───────────────────────────────────────────────────────────────

  function setAvailable(value: boolean) {
    if (available !== value) {
      available = value;
      availabilityListeners.forEach((cb) => cb(value));
    }
  }

  function generateRequestId(action: string): string {
    return `${idPrefix}_${action}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }

  // ── Message handler ───────────────────────────────────────────────────────

  function handleMessage(event: MessageEvent) {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.direction !== inboundDirection) return;

    // Availability signals
    if (data.action === "contentScriptReady") {
      setAvailable(true);
      return;
    }
    if (data.action === "extensionDead") {
      setAvailable(false);
      return;
    }
    if (data.action === "ping") {
      if (data.response?.success) setAvailable(true);
      else if (data.response?.error) setAvailable(false);
      return;
    }

    // Response to a pending request
    if (data.requestId && pending.has(data.requestId)) {
      const resolve = pending.get(data.requestId)!;
      pending.delete(data.requestId);
      resolve(data.response);
    }
  }

  // ── Polling ───────────────────────────────────────────────────────────────

  function doPing() {
    window.postMessage(
      {
        direction: outboundDirection,
        action: "ping",
        requestId: `poll_${idPrefix}_${Date.now()}`,
      },
      window.location.origin,
    );
  }

  // ── Public API ────────────────────────────────────────────────────────────

  function isAvailable() {
    return available;
  }

  function sendMessage<T = TResponse>(
    action: string,
    payload?: Record<string, unknown>,
    timeoutMs?: number,
  ): Promise<T> {
    const timeout = timeoutMs ?? defaultTimeoutMs;

    return new Promise<T>((resolve) => {
      const requestId = generateRequestId(action);

      const timer = setTimeout(() => {
        pending.delete(requestId);
        resolve({ success: false, error: "Timeout" } as T);
      }, timeout);

      pending.set(requestId, (response: unknown) => {
        clearTimeout(timer);
        resolve(response as T);
      });

      window.postMessage(
        { direction: outboundDirection, action, requestId, ...payload },
        window.location.origin,
      );
    });
  }

  function start() {
    window.addEventListener("message", handleMessage);
    if (pollIntervalMs > 0) {
      doPing();
      pollTimer = setInterval(doPing, pollIntervalMs);
    }
  }

  function stop() {
    window.removeEventListener("message", handleMessage);
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    // Reject all pending requests
    pending.forEach((resolve) => {
      resolve({ success: false, error: "Bridge stopped" });
    });
    pending.clear();
  }

  function onAvailabilityChange(cb: (avail: boolean) => void): () => void {
    availabilityListeners.add(cb);
    return () => {
      availabilityListeners.delete(cb);
    };
  }

  return { isAvailable, sendMessage, start, stop, onAvailabilityChange };
}
