/**
 * Rate Limiter + Circuit Breaker centralizzato per chiamate ad
 * API esterne fragili (LinkedIn, WhatsApp DOM, scraping in genere).
 *
 * Vol. II §10.3 (resilience patterns).
 *
 * Caratteristiche:
 *  - Token bucket per rate limiting (N richieste / window)
 *  - Circuit breaker 3-stati (closed/open/half-open)
 *  - Exponential backoff con jitter su 429/network error
 *  - Per-key isolation (es. una chiave per account LinkedIn)
 *  - Storage in-memory (singleton) — non persistito tra reload
 *
 * NOTA: per persistenza cross-tab usa Supabase realtime + tabella
 * `channel_rate_state`. Per ora è in-memory.
 */

import { createLogger } from "@/lib/log";

const logger = createLogger("rateLimiter");

export type CircuitState = "closed" | "open" | "half-open";

export interface RateLimiterConfig {
  /** Token bucket: N permessi per window (ms). */
  maxTokens: number;
  windowMs: number;
  /** Circuit breaker: dopo N fallimenti consecutivi → open. */
  failureThreshold: number;
  /** Tempo prima di passare da open a half-open. */
  resetMs: number;
  /** Backoff iniziale ms (raddoppiato a ogni retry). */
  baseBackoffMs: number;
  /** Max backoff ms. */
  maxBackoffMs: number;
}

const DEFAULT_CONFIG: RateLimiterConfig = {
  maxTokens: 30,
  windowMs: 60_000,
  failureThreshold: 5,
  resetMs: 5 * 60_000,
  baseBackoffMs: 1_000,
  maxBackoffMs: 60_000,
};

interface BucketState {
  tokens: number;
  windowStart: number;
  failures: number;
  lastFailureAt: number;
  circuit: CircuitState;
}

const buckets = new Map<string, BucketState>();
const configs = new Map<string, RateLimiterConfig>();

function getBucket(key: string): BucketState {
  let b = buckets.get(key);
  if (!b) {
    b = {
      tokens: getConfig(key).maxTokens,
      windowStart: Date.now(),
      failures: 0,
      lastFailureAt: 0,
      circuit: "closed",
    };
    buckets.set(key, b);
  }
  return b;
}

function getConfig(key: string): RateLimiterConfig {
  return configs.get(key) ?? DEFAULT_CONFIG;
}

/** Configura un rate limiter custom per una chiave specifica. */
export function configureRateLimiter(key: string, config: Partial<RateLimiterConfig>): void {
  configs.set(key, { ...DEFAULT_CONFIG, ...config });
}

function refillTokens(b: BucketState, cfg: RateLimiterConfig): void {
  const now = Date.now();
  if (now - b.windowStart >= cfg.windowMs) {
    b.tokens = cfg.maxTokens;
    b.windowStart = now;
  }
}

function tryHalfOpen(b: BucketState, cfg: RateLimiterConfig): void {
  if (b.circuit === "open" && Date.now() - b.lastFailureAt >= cfg.resetMs) {
    b.circuit = "half-open";
    logger.info("rate_limiter.circuit_half_open", { key: "[redacted]" });
  }
}

export class RateLimitedError extends Error {
  constructor(public readonly key: string, public readonly retryAfterMs: number) {
    super(`Rate limited on ${key}, retry in ${retryAfterMs}ms`);
    this.name = "RateLimitedError";
  }
}

export class CircuitOpenError extends Error {
  constructor(public readonly key: string, public readonly resetInMs: number) {
    super(`Circuit open on ${key}, reset in ${resetInMs}ms`);
    this.name = "CircuitOpenError";
  }
}

/**
 * Esegue una funzione async sotto la protezione di rate limiter +
 * circuit breaker. Riprova automaticamente con backoff su errori
 * di rete o 429, fino a `maxRetries` tentativi.
 *
 * @param key chiave di isolamento (es. "linkedin:user_id")
 * @param fn funzione async da eseguire
 * @param maxRetries default 3
 */
export async function withRateLimit<T>(
  key: string,
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  const cfg = getConfig(key);
  const b = getBucket(key);

  tryHalfOpen(b, cfg);

  if (b.circuit === "open") {
    const resetInMs = cfg.resetMs - (Date.now() - b.lastFailureAt);
    throw new CircuitOpenError(key, Math.max(0, resetInMs));
  }

  refillTokens(b, cfg);
  if (b.tokens <= 0) {
    const retryAfterMs = cfg.windowMs - (Date.now() - b.windowStart);
    throw new RateLimitedError(key, Math.max(0, retryAfterMs));
  }
  b.tokens -= 1;

  let attempt = 0;
  let lastError: unknown;
  while (attempt <= maxRetries) {
    try {
      const result = await fn();
      // Successo → reset failures, chiudi circuit se half-open
      b.failures = 0;
      if (b.circuit === "half-open") {
        b.circuit = "closed";
        logger.info("rate_limiter.circuit_closed", { key: "[redacted]" });
      }
      return result;
    } catch (err) {
      lastError = err;
      const isRetryable = isRetryableError(err);
      if (!isRetryable || attempt === maxRetries) break;
      const backoff = computeBackoff(attempt, cfg);
      logger.warn("rate_limiter.retry", {
        key: "[redacted]",
        attempt,
        backoffMs: backoff,
        error: errMessage(err),
      });
      await sleep(backoff);
      attempt += 1;
    }
  }

  // Esauriti i retry: incrementa failures, eventualmente apri circuit
  b.failures += 1;
  b.lastFailureAt = Date.now();
  if (b.failures >= cfg.failureThreshold) {
    b.circuit = "open";
    logger.error("rate_limiter.circuit_open", {
      key: "[redacted]",
      failures: b.failures,
      threshold: cfg.failureThreshold,
    });
  }
  throw lastError;
}

function isRetryableError(err: unknown): boolean {
  if (!err) return false;
  const msg = errMessage(err).toLowerCase();
  if (msg.includes("rate limit") || msg.includes("429")) return true;
  if (msg.includes("network") || msg.includes("timeout") || msg.includes("econnreset")) return true;
  if (msg.includes("503") || msg.includes("502") || msg.includes("504")) return true;
  return false;
}

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function computeBackoff(attempt: number, cfg: RateLimiterConfig): number {
  const exp = Math.min(cfg.baseBackoffMs * 2 ** attempt, cfg.maxBackoffMs);
  // Jitter ±25%
  const jitter = exp * (0.75 + Math.random() * 0.5);
  return Math.round(jitter);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Stato corrente di una chiave (utile per UI / health-check). */
export function getRateLimiterState(key: string): {
  circuit: CircuitState;
  failures: number;
  tokensRemaining: number;
} {
  const b = getBucket(key);
  const cfg = getConfig(key);
  refillTokens(b, cfg);
  return {
    circuit: b.circuit,
    failures: b.failures,
    tokensRemaining: b.tokens,
  };
}

/** Reset manuale (test, admin override). */
export function resetRateLimiter(key: string): void {
  buckets.delete(key);
}

/** Reset di tutti i bucket (test). */
export function resetAllRateLimiters(): void {
  buckets.clear();
}
