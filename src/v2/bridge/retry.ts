/**
 * Retry with Exponential Backoff — Vol. IV §2
 *
 * withRetry<T>(fn, options) → Promise<Result<T>>
 */

import { type Result, ok, err } from "../core/domain/result";
import { ioError, type AppError } from "../core/domain/errors";
import { createLogger } from "./internal-logger";

const logger = createLogger("Retry");

// ── Types ────────────────────────────────────────────────────────────

export interface RetryOptions {
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly shouldRetry?: (error: unknown, attempt: number) => boolean;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 1_000,
  maxDelayMs: 30_000,
};

// ── Public API ───────────────────────────────────────────────────────

export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: Partial<RetryOptions>,
): Promise<Result<T, AppError>> {
  const opts: RetryOptions = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      const value = await fn();
      return ok(value);
    } catch (caught: unknown) {
      lastError = caught;

      const shouldContinue = opts.shouldRetry
        ? opts.shouldRetry(caught, attempt)
        : true;

      if (!shouldContinue || attempt >= opts.maxAttempts) break;

      const delay = Math.min(
        opts.baseDelayMs * Math.pow(2, attempt - 1),
        opts.maxDelayMs,
      );

      logger.warn("retrying", {
        attempt,
        maxAttempts: opts.maxAttempts,
        nextDelayMs: delay,
        error: caught instanceof Error ? caught.message : String(caught),
      });

      await sleep(delay);
    }
  }

  const errorMessage =
    lastError instanceof Error ? lastError.message : String(lastError);

  return err(
    ioError("NETWORK_ERROR", `All ${opts.maxAttempts} attempts failed: ${errorMessage}`, {
      maxAttempts: opts.maxAttempts,
    }),
  );
}

// ── Internal ─────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
