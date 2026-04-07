/**
 * Shared API utilities: timeout, retry with back-off, and typed error class.
 * Designed to be consumed by wcaAppApi.ts and other fetch-based modules.
 */

// ── ApiError ──────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  /** HTTP status code (0 when the request never reached the server). */
  readonly status: number;
  /** Machine-readable error code, e.g. "TIMEOUT", "NETWORK_ERROR". */
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

// ── fetchWithTimeout ──────────────────────────────────────────────────────────

/**
 * Wraps `fetch` with an AbortController-based timeout.
 *
 * @param url      - Request URL
 * @param options  - Standard RequestInit (any existing signal is respected)
 * @param timeoutMs - Timeout in milliseconds (default 30 000)
 * @returns The Response object
 * @throws {ApiError} on timeout or network failure
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 30_000,
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  // If the caller already provided a signal, listen for its abort too
  if (options.signal) {
    options.signal.addEventListener("abort", () => controller.abort());
  }

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError(`Request to ${url} timed out after ${timeoutMs}ms`, 0, "TIMEOUT");
    }
    throw new ApiError(
      err instanceof Error ? err.message : "Network error",
      0,
      "NETWORK_ERROR",
    );
  } finally {
    clearTimeout(id);
  }
}

// ── fetchWithRetry ────────────────────────────────────────────────────────────

export interface RetryOptions {
  /** Maximum number of retry attempts (default 3). */
  retries?: number;
  /** Initial back-off delay in ms (default 1 000). Doubles on each retry. */
  backoffMs?: number;
  /** Per-request timeout in ms passed to fetchWithTimeout (default 30 000). */
  timeoutMs?: number;
  /** Optional predicate — return `false` to skip retrying on certain responses. */
  shouldRetry?: (response: Response) => boolean;
}

/**
 * Fetch with automatic retry and exponential back-off.
 *
 * Retries on:
 *  - Network / timeout errors
 *  - HTTP 429 (rate limit) and 5xx responses (unless `shouldRetry` says no)
 *
 * @returns A successful Response
 * @throws {ApiError} when all retries are exhausted
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retryOpts: RetryOptions = {},
): Promise<Response> {
  const {
    retries = 3,
    backoffMs = 1_000,
    timeoutMs = 30_000,
    shouldRetry,
  } = retryOpts;

  let lastError: ApiError | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options, timeoutMs);

      // Success — return immediately
      if (response.ok) return response;

      // Non-retryable status
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || (shouldRetry && !shouldRetry(response))) {
        throw new ApiError(
          `HTTP ${response.status} ${response.statusText}`,
          response.status,
          `HTTP_${response.status}`,
        );
      }

      lastError = new ApiError(
        `HTTP ${response.status} ${response.statusText}`,
        response.status,
        `HTTP_${response.status}`,
      );
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        lastError = err;
        // Non-retryable client errors (4xx except 429)
        if (err.status >= 400 && err.status < 500 && err.status !== 429) throw err;
      } else {
        lastError = new ApiError(
          err instanceof Error ? err.message : "Unknown error",
          0,
          "UNKNOWN",
        );
      }
    }

    // Back-off before next attempt (skip after last attempt)
    if (attempt < retries) {
      const delay = backoffMs * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError ?? new ApiError("All retries exhausted", 0, "RETRIES_EXHAUSTED");
}
